const express=require('express')
const router=express.Router();

const HodController=require('../controllers/admin.controll/hodadmincontroller');


router.get('/get-tl',HodController.searchTL)
router.post('assign-hod',HodController.assignTLToHOD);
router.post('/')


module.exports=router;