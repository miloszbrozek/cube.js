const redis = require('redis');
const redisearch  = require('redis-redisearch');
redisearch(redis);
redis.addCommand('ft.aggregate'); // there is a bug in redisearch and ft.aggregate is being added to redis
const { promisify } = require('util');

class RedisClient {
    constructor(config) {
        this.config = config
    }

    _getClient() {
        if (!this.client) {
            this.client = redis.createClient(this.config);
            this.client.on('error', (err) => {
                console.log(`Unexpected error on redis client: ${err.stack || err}`);
            });
        }
        return this.client;
    }

    releaseConnection() {
        if (this.client) {
            this.client.quit();
        }
    }

    async get(args) {
        const client = this._getClient();
        const getAsync = promisify(client.get).bind(client);
        return await getAsync(args);
    }

    escape(identifier) {
        return identifier.split(" ").join('\\ ')
            .split("}").join("\\}")
            .split("{").join("\\{");
    }

    buildAggregateArgs(options) {
        const { indexName, groupBy, reduce, filters, sort, limit } = options;
        const filterEntries = (filters|| []).map(filter => `@${this.escape(filter.column)}:{${filter.value}}`)
        const filterArgs = filterEntries.length === 0 ? ['*'] : [filterEntries.join(' ')];
        const reduceArgs = reduce ? ['REDUCE', reduce.fn, "0" , "AS", reduce.alias] : [];

        const sortEntries = (sort || []).flatMap(sortEntry => [`@${sortEntry.column}`, sortEntry.direction]);
        const sortArgs = sort ? ['SORTBY', sortEntries.length, ...sortEntries]: [];

        const groupByEntries = (groupBy || []).map(groupEntry => `@${groupEntry}`);
        const groupByArgs =  groupBy ? ['GROUPBY', groupByEntries.length, ...groupByEntries] : [];
        const limitArgs = limit ? ['LIMIT', 0, limit] : [];

        return [indexName, ...filterArgs, ...groupByArgs, ...reduceArgs, ...sortArgs, ...limitArgs];
    }

    rawRedisItemIntoRow(rawItem, aliases) {
        return rawItem.reduce((acc, el, idx) => {
            if(idx % 2 === 0) {
                const fieldName = aliases[el] ? aliases[el] : el;
                const fieldValue = rawItem[idx+1];
                acc[fieldName] = fieldValue;
            }
            return acc;
        }, {});
    }

    aggregateResultsToRows(rawResults, aliases) {
        // ignore the first row and treat everything else as data
        return rawResults.slice(1).map(rawItem => this.rawRedisItemIntoRow(rawItem, aliases));
    }

    async aggregate(options) {
        const client = this._getClient();
        const aggregateAsync = promisify(client.ft_aggregate).bind(client);
        const aggregateArgs = this.buildAggregateArgs(options);
        const rawResult = await aggregateAsync(aggregateArgs);
        return this.aggregateResultsToRows(rawResult, options.aliases || {})
    }

    infoResultsToFieldsMetadata(rawResult) {
        const rootObject = this.rawRedisItemIntoRow(rawResult, []);
        return rootObject.fields.map(fieldRawEntry => {
            return {
                name: fieldRawEntry[0],
                type: 'text',
                attributes: [],
            }
        });
    }

    async getIndexFields(indexName) {
        const client = this._getClient();
        const infoAsync = promisify(client.ft_info).bind(client);
        const rawResult = await infoAsync(indexName);
        return this.infoResultsToFieldsMetadata(rawResult);
    }
}

module.exports = RedisClient;