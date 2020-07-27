## Redisearch playground

### Prepare project to run
#### Prepare redis driver
```
cd ./packages/cubejs-redis-driver
yarn install
yarn link
cd ../../
```
#### Prepare cubejs-server-core
```
cd ./packages/cubejs-server-core
yarn install
yarn link
yarn link @cubejs-backend/redis-driver
cd ../../
```
#### Prepare cubejs-playground
```
cd ./packages/cubejs-playground
yarn install
yarn build
cd ../../
```
#### Prepare redisearch playground
```
cd ./examples/redisearch-playground
yarn install
yarn link @cubejs-backend/server-core
cd ../../
```
#### Prepare redis data
1. Download [Donors.csv](https://www.kaggle.com/hanselhansel/donorschoose?select=Donors.csv) and place it in **examples/redisearch-playground/scripts/redis-data** folder.
2. Open in terminal **examples/redisearch-playground** and run **docker-compose up -d**. That should start redis database exposed on localhost at port 6379.
3. Open in terminal **examples/redisearch-playground/scripts/redis-data/redis-import** and run **yarn install** and **yarn dev**. It takes around 1 minute to import the data.

### Launch cubejs playground with Redis driver
1. Open in terminal **examples/redisearch-playground** and run **docker-compose up -d**, then run **yarn dev**.
2. Open [http://localhost:4000](http://localhost:4000)

### Known limitations
Filtering works on multiple filters but only "equals" condition is handled. I could implement more operators in **_whereAstToRedisFilterExpressions** but this function can be easily extended and I think the main concept is well shown.
I didn't find a way to read a list of indexes defined in redisearch database so I'm providing them to the driver as comma separated list in CUBEJS_REDISEARCH_INDEX_LIST env variable. 

### What works for sure
* Drives handles queries on 0, 1 or more dimensions (though certain combinations take a bit of time for Redis to process)
* 0, 1 or multiple filters can be applied to driver
* Driver displays the schema (though there's just one index out there so it might not be impressive at all)
* Driver handles sorting on measure and dimensions
* I tested it on table chart mostly (this probably doesn't matter if playground works as I expect)

Sample query I clicked: [query](http://localhost:4000/#/build?query={%22measures%22:[%22Donors.count%22],%22timeDimensions%22:[],%22order%22:{},%22dimensions%22:[%22Donors.donorIsTeacher%22,%22Donors.donorCity%22,%22Donors.donorIsTeacher%22],%22filters%22:[{%22dimension%22:%22Donors.donorIsTeacher%22,%22operator%22:%22equals%22,%22values%22:[%22No%22]},{%22dimension%22:%22Donors.donorCity%22,%22operator%22:%22equals%22,%22values%22:[%22Jersey%20City%22]}]})