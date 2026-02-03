const mongoose = require('mongoose');


const staticData=mongoose.createConnection(process.env.MONGO_URL_STATICDATA)// using the ssa db which is free 
const dynamicData=mongoose.createConnection(process.env.MONGO_URL_DYNAMICDATA)// useing the db M10 purchase attendance portal db 

module.exports={staticData,dynamicData};