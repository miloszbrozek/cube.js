const { Parser } = require('node-sql-parser');
const BaseDriver = require('@cubejs-backend/query-orchestrator/driver/BaseDriver');
const RedisClient = require('./RedisClient');
const R = require('ramda');
const RedisQuery = require('./RedisQuery');


class RedisDriver extends BaseDriver {
  static dialectClass() {
    return RedisQuery;
  }

  constructor(config) {
    super();
    this.config = config || {};
    this.dummyRedisSchema = process.env.CUBEJS_REDISEARCH_DUMMY_SCHEMA || 'test';
    this.redisIndexList = process.env.CUBEJS_REDISEARCH_INDEX_LIST ? process.env.CUBEJS_REDISEARCH_INDEX_LIST.split(','): [];
    if(this.redisIndexList.length === 0){
      throw Error('Please setup CUBEJS_REDISEARCH_INDEX_LIST env variable');
    }
    this.client = new RedisClient({
      host: process.env.CUBEJS_DB_HOST,
      port: process.env.CUBEJS_DB_PORT,
      password: process.env.CUBEJS_DB_PASS,
      db: process.env.CUBEJS_DB_NAME,
      ...config
    })
  }

  async testConnection() {
    await this.client.get("foo");
  }

  async queryResponse(query, values) {
    try {
      const parser = new Parser();
      // TODO: I know it's unsafe to replace params like that but I think Redis injection protection is not the goal of this exercise
      let replacedQuery = values.reduce((query, value) => {
        const replacement = typeof value === 'number' ?  value : `'${value}'`;
        return query.replace("?", replacement);
      }, query);
      const ast = parser.astify(replacedQuery);
      const aggregateOptions = await this.sqlAstToRedisAggregateOptions(ast);
      const result = await this.client.aggregate(aggregateOptions);
      return result;
    } catch(err) {
      console.log(err);
      throw err;
    }
  }

  _whereAstToRedisFilterExpressions(whereAst, indexFields) {
    if(whereAst.operator === '=') {
      const sides = [whereAst.left, whereAst.right];
      const columnNameSide = sides.find(side => indexFields.includes(side.column || side.value));
      const valueSide = sides.find(side => side !== columnNameSide);
      if(!columnNameSide) {
        const sidesAsStrings = sides.map(side => side.column || side.value);
        throw new Error(`Unable to find filter column in WHERE clause: ${sidesAsStrings[0]} = ${sidesAsStrings[1]}`);
      }
      return [{column: columnNameSide.column || columnNameSide.value, value: valueSide.value}];
    } else if (whereAst.operator === 'AND') {
      return [
        ...this._whereAstToRedisFilterExpressions(whereAst.left, indexFields),
        ...this._whereAstToRedisFilterExpressions(whereAst.right, indexFields),
      ];
    } else {
      throw new Error(`Unsupported operator: ${whereAst.operator}`);
    }
  }

  async sqlAstToRedisAggregateOptions(ast) {
    if(!ast.from || ast.from.length !==1 || !ast.from[0]['table']) {
      throw new Error("Only one source table is supported for redis queries");
    }
    const {db, table} = ast.from[0];
    const aggregateColumn = ast.columns.find(column => column.expr.type === "aggr_func");
    if(!aggregateColumn) {
      throw new Error(`Unable to convert SQL query into redis format. Aggregation column not found`);
    } else if(aggregateColumn.expr.name !== 'COUNT' || aggregateColumn.expr.args.expr.type !== 'star') {
      throw new Error(`Unable to convert SQL query into redis format. Unsupported aggregation type: ${aggregateColumn.expr.name}`);
    }
    const reduce = {fn: 'COUNT', alias: aggregateColumn['as'] || 'CNT'};
    const allColumnNames = ast.columns.map(column => {
      if (column === aggregateColumn){
        return reduce.alias;
      } else {
        return column.expr.value || column.expr.name || column.expr.column;
      }
    });
    const groupBy = (ast.groupby || []).map(groupBy => groupBy.type === 'number' ? allColumnNames[groupBy.value-1]: groupBy.value);
    if(ast.having) {
      throw new Error("HAVING clause is not supported for redis queries");
    }
    const aliases = ast.columns.filter(column => column.expr.type === 'string')
        .reduce((acc, column) => {
          const alias = column['as'] || column.expr.value;
          acc[column.expr.value] = alias;
          return acc;
        }, {});


    const indexFieldNames = (await this.tableColumnTypes(`${db}.${table}`)).map(column => column.name);
    const filters = ast.where ? this._whereAstToRedisFilterExpressions(ast.where, indexFieldNames) : [];
    const sort = (ast.orderby || []).map(orderBy => {
      const orderByColumn = orderBy.expr.type === 'number' ? allColumnNames[orderBy.expr.value-1]: orderBy.expr.value;
      return {column: orderByColumn, direction: orderBy.type || 'ASC'}
    });
    const limit = ast.limit && ast.limit.value[0] ? ast.limit.value[0].value : undefined;

    return {
      indexName: table,
      groupBy,
      aliases,
      reduce,
      filters,
      sort,
      limit,
    };
  }

  async query(query, values) {
    return (await this.queryResponse(query, values));
  }

  async downloadQueryResults(query, values) {
    throw new Error('Not implemented');
  }

  createSchemaIfNotExists(schemaName) {
    throw new Error('Not implemented');
  }

  async getTablesQuery(schemaName) {
    const allSchemas = await this.tablesSchema();
    return allSchemas[schemaName].map(schema => Object.keys(schema));
  }

  async tablesSchema() {
    const resolvedIndexObjects = await Promise.all(this.redisIndexList.map(indexName => {
      return this.client.getIndexFields(indexName).then(indexFields => {
        return Promise.resolve({
          [indexName]: indexFields
        });
      });
    }));

    return {
      [this.dummyRedisSchema]: R.mergeAll(resolvedIndexObjects)
    };
  }

  dropTable(tableName, options) {
    throw new Error("Not implemented");
  }

  async uploadTable(table, columns, tableData) {
    throw new Error("Not implemented");
  }

  async downloadTable(table) {
    throw new Error("Not implemented");
  }

  async tableColumnTypes(table) {
    const [schemaName, tableName] = table.split('.');
    const allSchemasData = await this.tablesSchema();
    const schemaTables = allSchemasData[schemaName] || {};
    const tableColumns = schemaTables[tableName] || [];
    return tableColumns;
  }

  release() {
    return this.client.releaseConnection();
  }
}

module.exports = RedisDriver;
