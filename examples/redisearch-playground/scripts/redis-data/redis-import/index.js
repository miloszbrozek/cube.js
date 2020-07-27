const csv = require('csv-parser');
const fs = require('fs');
const redis = require("redis");
const redisearch  = require('redis-redisearch');
redisearch(redis);
redis.addCommand('ft.aggregate');
const { promisify } = require('util');

const client = getConnection({
    host: 'localhost',
    port: '6379',
    db: '0'
});

uploadCsv(client, '../Donors.csv',
    'donors',
    ['Donor ID', 'Donor City', 'Donor State', 'Donor Is Teacher', 'Donor Zip'],
    'Donor ID');

function getConnection(connectionOptions) {
    const client = redis.createClient(connectionOptions);
    client.on('error', (err) => {
        console.log(`Unexpected error on redis client: ${err.stack || err}`);
    });
    return client;
}

function dropTable(client, tableName) {
    const dropAsync = promisify(client.ft_drop).bind(client);
    return dropAsync(tableName)
        .then(()=>{
            return Promise.resolve();
        })
        .catch((err)=>{
            console.log(err);
            return Promise.resolve();
        })
}

function createTable(client, tableName, columnNames, keyField) {
    const createAsync = promisify(client.ft_create).bind(client);
    const columns = columnNames.flatMap(columnName => {
        if(columnName !== keyField) {
            return [columnName, "TAG"];
        }
        return [columnName, "TEXT"];
    });
    return createAsync(tableName, ["SCHEMA", ...columns])
        .then(()=>{
            return Promise.resolve();
        })
        .catch((err)=>{
            console.log(err);
            return Promise.resolve();
        })
}

function uploadCsv(client, filePath, tableName, columnNames, keyField){
    let i = 0;
    const addAsync = promisify(client.ft_add).bind(client);
    dropTable(client, tableName).then(()=>{
        return createTable(client, tableName, columnNames);
    }).then(()=>{
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => {
                const dataArray = Object.keys(data).flatMap(key => [key, data[key]]);
                const key = data[keyField];

                addAsync(tableName, key, 1.0, 'FIELDS', ...dataArray).then(()=>{
                    if(i%1000 == 0){
                        console.log('Row number: ' + i);
                    }
                    ++i;
                }).catch(console.log)
            })
            .on('end', () => {
                client.quit();
            });
    })
}


