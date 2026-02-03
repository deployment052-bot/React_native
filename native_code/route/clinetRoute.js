const express=require('express')
const router=express.Router();
const Client=require('../contorller/clientcontroller')


router.get('/getclientwork',Client.getAllWorks)


module.exports=router;

