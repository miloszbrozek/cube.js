const R = require('ramda');
const MysqlQuery = require('@cubejs-backend/schema-compiler/adapter/MysqlQuery');

class RedisQuery extends MysqlQuery {
    baseWhere(filters) {
        // SQL parser used by RedisDriver is not able to handle WHERE clause with multiple clauses while each clause is enclosed in parentheses
        // so there was a need to override this function just to remove redundant parentheses
        const filterClause = filters.map(t => t.filterToWhere()).filter(R.identity).map(f => `${f}`);
        return filterClause.length ? ` WHERE ${filterClause.join(' AND ')}` : '';
    }
}

module.exports = RedisQuery;