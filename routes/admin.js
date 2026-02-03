const express = require("express");
const { protect , authorize,authorizeHOD,authorizeTl } = require("../middelware/authMiddelware");
const router = express.Router();
const {

  getTechnicianWorkForAdmin,getAllTechniciansForAdmin,getAllClientForAdmin,getclientWorkForAdmin,getAllWorkAdmin,resolveWorkIssue,getOpenIssues,getAllIssues,getPartsPendingRequests,updatePartStatus,getAllPartsRequests,getNeedPartsByWorkId,getIssueChartCounts,unresolveWorkIssue,getOrdersClientsGraph,getClientLedgerAdmin
} = require("../controllers/admincontrooler");
// const { getAllTechnicianWorks } = require("../controllers/techniciancontroller");
const tl=require('../controllers/admin.controll/tlcontroller')

router.post('/issue-resolve',resolveWorkIssue) // hit the resolve
router.post('/get-technician',protect,authorize('admin',"TL"),getTechnicianWorkForAdmin)
router.get('/gettechnican',protect,authorize('Hod'),authorizeHOD('opretion_department'),getAllTechniciansForAdmin );

// this is for routing about the tl phase 
router.get('/techworkfortl/:id',protect,authorize('admin','Hod'),authorizeHOD('opretion_department'),tl.monitortech)
router.get('/techfortl/:id',protect,authorize('Hod'),authorizeHOD('opretion_department'),tl.checkstatus)

router.get('/getclient',protect,authorize('admin'),getAllClientForAdmin);
router.post('/getclientwork',protect,authorize('admin'),getclientWorkForAdmin);
router.get('/getAllWorkadmin',protect,authorize('admin'),getAllWorkAdmin)

router.get('/getnewissue',protect,authorize('admin','TL'),getOpenIssues)// ye wala route jb tk koi issue open h wo data dega

router.get('/getallissue',protect,authorize('admin'),getAllIssues)// ye wala all route ko dikhayega 

router.get('/ladger/:clientId',protect,authorize('admin'),getClientLedgerAdmin)
//after this every route is for to the making the matairial 
router.get('/getneedpartsrequest',protect,authorize('admin'),getPartsPendingRequests) // for to fetching the needparts issue
router.put('/approverejectbyadmin',protect,authorize('admin'),updatePartStatus) // for to make action on the needpart request
router.get('/getneedpart',protect,authorize('admin'),getAllPartsRequests)
router.get('/getneedbyid/:workId',protect,authorize('admin'),getNeedPartsByWorkId)
router.get('/getpi',protect,authorize('admin'),getIssueChartCounts)
router.post('/unresolve-issue',protect,authorize('admin'),unresolveWorkIssue) // hit the unresolved issue
router.get('/getline',protect,authorize('admin'),getOrdersClientsGraph)
module.exports = router;
