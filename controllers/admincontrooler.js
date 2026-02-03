const mongoose= require('mongoose')
const Work = require("../model/work");
const jwt = require("jsonwebtoken");
const User = require("../model/user");
const axios = require("axios");
const admin = require("firebase-admin");
const { cache } = require("../utils/redis");
// const { cache, client: redisClient } = require("../utils/redis");
exports.resolveWorkIssue = async (req, res) => {
  try {
    const { workId, issueId } = req.body;
   const adminId =
      req.user && req.user._id ? req.user._id : req.body.adminId;

    const work = await Work.findById(workId);
    if (!work) return res.status(404).json({ message: "Work not found" });

    const issue = work.issues.id(issueId);
    if (!issue) return res.status(404).json({ message: "Issue not found" });

    
    issue.status = "resolved";
    issue.resolvedBy = adminId;
    issue.resolvedAt = new Date();

    //     if (issue.issueType === "need_specialist") {
    //   issue.specialistInfo = {
    //     technicianName: `${work.assignedTechnician.firstName} ${work.assignedTechnician.lastName}`,
    //     technicianPhone: work.assignedTechnician.phone,
    //   };
    // }

   
    work.issueCount = Math.max(0, (work.issueCount || 0) - 1);

   
    const openIssues = work.issues.filter((i) => i.status === "open");
    if (openIssues.length === 0) {
      work.status = "inprogress";
    }

    await work.save();
    const technicianUser = await User.findById(technicianId).select("fcmToken");
if (technicianUser?.fcmToken) {
  await admin.messaging().send({
    token: technicianUser.fcmToken,
    notification: {
      title: "Issue Resolved",
      body: `Your issue is resolved for ${work._id.token}`,
    },
    data: {
      type: "issue_resolved",
      link: `work-${lockedWork.token}`,
    },
  });
}
    res.status(200).json({
      message: "Issue resolved successfully",
      work,
    });

  } catch (error) {
    console.error("Resolve Issue Error:", error);
    res.status(500).json({ message: "Failed to resolve issue" });
  }
};

exports.unresolveWorkIssue = async (req, res) => {
  try {
    const { workId, issueId } = req.body;
    const adminId = req.user?._id || req.body.adminId;

    const work = await Work.findById(workId);
    if (!work) return res.status(404).json({ message: "Work not found" });

    const issue = work.issues.id(issueId);
    if (!issue) return res.status(404).json({ message: "Issue not found" });

    if (issue.status !== "resolved") {
      return res.status(400).json({
        message: "Only resolved issues can be marked as unresolved",
      });
    }

    issue.status = "unresolved";
    issue.unresolvedBy = adminId;
    issue.unresolvedAt = new Date();

 
    work.issueCount = (work.issueCount || 0) + 1;

   
    const activeIssues = work.issues.filter(
      (i) => i.status === "open" || i.status === "unresolved"
    );

    if (activeIssues.length > 0) {
      work.status = "issue_pending";
    }

    await work.save();

    res.status(200).json({
      success: true,
      message: "Issue marked as unresolved",
      work,
    });

  } catch (error) {
    console.error("Unresolve Issue Error:", error);
    res.status(500).json({ message: "Failed to unresolve issue" });
  }
};



exports.getTechnicianWorkForAdmin = async (req, res) => {
  const { technicianId } = req.body;
  if (!technicianId) return res.status(400).json({ message: "Technician ID is required" });

  const key = `techwork:${technicianId}`;

  try {
    const data = await cache(key, async () => {
      const technician = await User.findById(technicianId).select("firstName lastName email phone");
      const works = await Work.find({ assignedTechnician: technicianId })
        .populate("client", "firstName lastName phone location")
        .populate("invoice")
        .sort({ createdAt: -1 });

      const totalWorkCount = works.length;
      const activeCount = works.filter(w => ["on_the_way", "inprogress", "approved","dispatch"].includes(w.status)).length;
      const completedCount = works.filter(w => w.status === "completed").length;
      const rejectedCount = works.filter(w => w.status === "rejected").length;
      const totalEarnings = works.reduce((sum, work) => (sum + (work.invoice?.total || 0) + (work.serviceCharge || 0)), 0);

      return { technician, summary: { totalWorkCount, activeCount, completedCount, rejectedCount, totalEarnings }, works };
    }, 60); // cache 60 seconds

    res.status(200).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch data", error: error.message });
  }
};


exports.getAllTechniciansForAdmin = async (req, res) => {
  try {
    const technicians = await cache("all_technicians", async () => {
      return await User.find({ role: "technician" })
        .select("firstName lastName email phone createdAt location specialization responsibility");
    }, 120); 

    res.status(200).json({
      success: true,
      count: technicians.length,
      technicians,
    });
  } catch (err) {
    console.error("Get All Technicians Error:", err);
    res.status(500).json({
      success: false,
      message: "Unable to fetch technicians",
    });
  }
};

exports.getAllClientForAdmin=async (req,res)=>{
try{
    const client =await User.find ({role:"client"})
  .select("firstName lastName email phone location createdAt");
  res.status(200).json
({
  success:true,
  count:client.length,
  client,
})
}catch(err){
console.error("Get all client error",err)
res.status(500).json
({
  success:false,
  message:"unable to fetch client "
})}

};

exports.getclientWorkForAdmin = async (req, res) => {
  try {
    const { client } = req.body;

    if (!client) {
      return res.status(400).json({ message: "client ID is required" });
    }

   
    const clientid = await User.findById(client).select(
      "firstName lastName email phone"
    );
     console.log(clientid)
    if (!clientid) {
      return res.status(404).json({ message: "client not found" });
    }

 
    const works = await Work.find({ client: clientid })
      .populate("assignedTechnician", "firstName lastName phone location specialization")
      
      .sort({ createdAt: -1 });

 
    const totalWorkCount = works.length;

    const activeCount = works.filter(w =>
      ["on_the_way", "inprogress","approved","dispatch"].includes(w.status)
    ).length;

    const completedCount = works.filter(w => w.status === "completed").length;

    const rejectedCount = works.filter(w => w.status === "rejected").length;
res.status(200).json({
      success: true,
      clientid,
      summary: {
        totalWorkCount,
        activeCount,
        completedCount,
        rejectedCount,
      
      },
      works,  
    });

  } catch (error) {
    console.error("Admin Technician Work Summary Error:", error);
    res.status(500).json({
      message: "Failed to fetch technician work summary",
      error: error.message,
    });
  }
};


exports.getAllWorkAdmin = async (req, res) => {
  try {
    const cacheKey = "admin:works:all";

    const work = await cache(
      cacheKey,
      async () => {
        return await Work.find({})
          .populate("client", "firstName lastName email phone location createdAt")
          .populate("assignedTechnician", "firstName lastName email phone location")
          .sort({ createdAt: -1 }); 
      },
      60 
    );

    res.status(200).json({
      success: true,
      count: work.length,
      work,
    });

  } catch (err) {
    console.error("Get all work error", err);
    res.status(500).json({
      success: false,
      message: "unable to fetch work",
    });
  }
};

exports.getOpenIssues = async (req, res) => {
  try {
    const countResult = await Work.aggregate([
      { $unwind: "$issues" },
      { $match: { "issues.status": "open" } },
      { $count: "count" }
    ]);

    const openIssueCount = countResult.length > 0 ? countResult[0].count : 0;

    const worksWithIssues = await Work.find({ "issues.status": "open" })
      .populate("client", "firstName lastName phone location")
      .populate("assignedTechnician", "firstName lastName phone")
      .sort({ createdAt: -1 });

    const issuesList = [];

    worksWithIssues.forEach(work => {
      work.issues.forEach(issue => {

        if (issue.status === "open") {
          let pendingPartsCount = 0;

          if (issue.issueType === "need_parts" && issue.parts) {
            pendingPartsCount = issue.parts.filter(
              p => p.status === "pending_fastresponse"
            ).length;
          }

          issuesList.push({
            issueId: issue._id,
            message: issue.message,
            raisedBy: issue.raisedBy,
            raisedAt: issue.raisedAt,
            workId: work._id,
            workStatus: work.status,
            serviceType: work.serviceType,
            client: work.client,
            issueType: issue.issueType,
            technician: work.assignedTechnician,
            pendingPartsCount // ✔ Added Here
          });
        }
      });
    });

    res.status(200).json({
      success: true,
      count: openIssueCount,
      issues: issuesList
    });

  } catch (err) {
    console.error("Open Issues Fetch Error:", err);
    res.status(500).json({ message: "Failed to fetch open issues" });
  }
};

exports.getAllIssues = async (req, res) => {
  try {
    const { status } = req.query; 
    const matchStage = {};

    if (status) {
      matchStage["issues.status"] = status;
    }

    const worksWithIssues = await Work.aggregate([
      { $unwind: "$issues" },
      { $match: Object.keys(matchStage).length ? matchStage : {} },
      {
        $project: {
          workId: "$_id",
          client: 1,
          assignedTechnician: 1,
          serviceType: 1,
          token: 1,
          issue: "$issues"
        }
      },
      { $sort: { "issue.raisedAt": -1 } }
    ]);

    const populated = await Promise.all(
      worksWithIssues.map(async (item) => {
        const client = await User.findById(item.client).select("firstName lastName phone");
        const technician = await User.findById(item.assignedTechnician).select("firstName lastName phone");

        let pendingPartsCount = 0;
        if (item.issue.issueType === "need_parts" && item.issue.parts) {
          pendingPartsCount = item.issue.parts.filter(
            p => p.status === "pending_fastresponse",
            p=>p.status === "approved_fastresponse"
          ).length;
        }

        return {
          ...item,
          client,
          technician,
          pendingPartsCount // ✔ Added Here
        };
      })
    );

    res.status(200).json({
      success: true,
      totalIssues: populated.length,
      issues: populated
    });

  } catch (err) {
    console.error("Get All Issues Error:", err);
    res.status(500).json({
      message: "Failed to fetch issues",
      error: err.message,
    });
  }
};

exports.getPartsPendingRequests = async (req, res) => {
  try {
    const works = await Work.find({
      "issues.issueType": "need_parts",
    })
      .populate("client", "firstName lastName phone location")
      .populate("assignedTechnician", "firstName lastName phone");

    let grandTotalPendingParts = 0;

    const finalResponse = works
      .map((work) => {
        let workPendingCount = 0;

        const filteredIssues = work.issues
          .map((issue) => {
            if (issue.issueType !== "need_parts") return null;

            // Count pending parts only (open or pending_fastresponse)
            const pendingPartsCount = issue.parts.filter(
              (p) => p.status === "open" || p.status === "pending_fastresponse"
            ).length;

            if (pendingPartsCount === 0) return null; // no pending parts → skip issue

            workPendingCount += pendingPartsCount;
            grandTotalPendingParts += pendingPartsCount;

            return {
              ...issue.toObject(),
              pendingPartsCount,

              // Show ALL parts (details) with isPending flag
              parts: issue.parts.map((p) => ({
                _id: p._id,
                itemName: p.itemName,
                quantity: p.quantity,
                status: p.status,
                remarks: p.remarks,
                isPending: p.status === "open" || p.status === "pending_fastresponse"
              }))
            };
          })
          .filter(Boolean);

        if (!filteredIssues.length) return null;

        return {
          ...work.toObject(),
          issues: filteredIssues,
          pendingPartsCount: workPendingCount
        };
      })
      .filter(Boolean);

    res.status(200).json({
      success: true,
      totalPendingParts: grandTotalPendingParts,
      works: finalResponse
    });

  } catch (err) {
    console.error("Error fetching pending parts:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updatePartStatus = async (req, res) => {
  try {
    const { workId, issueId, partId, action } = req.body;

    const newStatus =
      action === "approve"
        ? "approved_fastresponse"
        : "rejected_fastresponse";

    const work = await Work.findOneAndUpdate(
      {
        _id: workId,
        "issues._id": issueId,
        "issues.parts._id": partId,
      },
      {
        $set: {
          "issues.$[i].parts.$[p].status": newStatus,
          "issues.$[i].parts.$[p].updatedOn": new Date(),
        },
      },
      {
        arrayFilters: [{ "i._id": issueId }, { "p._id": partId }],
        new: true,
      }
    );

    if (!work) {
      return res.status(404).json({ message: "Part not found" });
    }

    const issue = work.issues.id(issueId);

    const stillPending = issue.parts.some(
      (p) => p.status === "pending_fastresponse"
    );

    if (!stillPending) {
      
      issue.parts.forEach((p) => {
        if (p.status === "approved_fastresponse") {
          p.status = "pending_ims";
        }
      });

      await work.save();

      console.log("Sending approved parts to IMS...");

      const imsToken = jwt.sign(
        { system: "FR" },
        process.env.IMS_JWT_SECRET,
        { expiresIn: "1d" }
      );

      const imsRequests = issue.parts
        .filter((p) => p.status === "pending_ims")
        .map((p) => ({
          itemName: p.itemName,
          quantity: p.quantity,
          Decofitem: p.Decofitem || "not provided", 
          requiredDate: p.requiredDate || new Date(),
          deliveryAddress: work.location || "",
          workRefId: work._id,
          partRefId: p._id,
        }));

      const imsBaseUrl = process.env.IMS_BASE_URL;

      await Promise.all(
        imsRequests.map((reqObj) =>
          axios.post(`${imsBaseUrl}/api/request/from-fr`, reqObj, {
            headers: { Authorization: `Bearer ${imsToken}` },
            
          })
          
        )
        
      );
    
      console.log("IMS Requests Sent Successfully! 🚀");
    }

    return res.status(200).json({
      success: true,
      message: `Part status updated to ${newStatus}`,
      work,
    });
  } catch (error) {
    console.error("Update Part Status Error:", error);
    return res.status(500).json({
      message: "Failed to update part status",
      error: error.message,
    });
  }
};

exports.getAllPartsRequests = async (req, res) => {
  try {
    // Fetch all works that have "need_parts" issues
    const works = await Work.find({
      "issues.issueType": "need_parts"
    })
      .populate("client", "firstName lastName phone location")
      .populate("assignedTechnician", "firstName lastName phone");

    let totalPendingParts = 0;

    const finalData = works.map((work) => {
      let workPendingCount = 0;

      const issues = work.issues
        .filter(issue => issue.issueType === "need_parts")
        .map(issue => {
          // Count pending parts only
          const pendingPartsCount = issue.parts.filter(
            p => p.status === "open" || p.status === "pending_fastresponse"
          ).length;

          workPendingCount += pendingPartsCount;
          totalPendingParts += pendingPartsCount;

          // Map all parts with full details + isPending flag
          const parts = issue.parts.map(p => ({
            _id: p._id,
            itemName: p.itemName,
            quantity: p.quantity,
            status: p.status,
            remarks: p.remarks,
            isPending: p.status === "open" || p.status === "pending_fastresponse",
            requiredDate: p.requiredDate || null,
            Decofitem: p.Decofitem || null,
            updatedOn: p.updatedOn || null
          }));

          return {
            ...issue.toObject(),
            pendingPartsCount,
            parts
          };
        });

      return {
        ...work.toObject(),
        issues,
        pendingPartsCount: workPendingCount
      };
    });

    res.status(200).json({
      success: true,
      totalPendingParts,
      works: finalData
    });

  } catch (err) {
    console.error("Error fetching all need parts:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getNeedPartsByWorkId = async (req, res) => {
  try {
    const { workId } = req.params;

    if (!workId) {
      return res.status(400).json({ success: false, message: "Work ID is required" });
    }

    const work = await Work.findById(workId)
      .populate("client", "firstName lastName phone location")
      .populate("assignedTechnician", "firstName lastName phone");

    if (!work) {
      return res.status(404).json({ success: false, message: "Work not found" });
    }

 
    const issues = work.issues
      .filter(issue => issue.issueType === "need_parts")
      .map(issue => {
        const pendingPartsCount = issue.parts.filter(
          p => p.status === "open" || p.status === "pending_fastresponse"
        ).length;

        const parts = issue.parts.map(p => ({
          _id: p._id,
          itemName: p.itemName,
          quantity: p.quantity,
          status: p.status,
          remarks: p.remarks,
          isPending: p.status === "open" || p.status === "pending_fastresponse",
          requiredDate: p.requiredDate || null,
          Decofitem: p.Decofitem || null,
          updatedOn: p.updatedOn || null
        }));

        return {
          ...issue.toObject(),
          pendingPartsCount,
          parts
        };
      });

    res.status(200).json({
      success: true,
      workId: work._id,
      client: work.client,
      technician: work.assignedTechnician,
      issues,
      totalPendingParts: issues.reduce((acc, i) => acc + i.pendingPartsCount, 0)
    });

  } catch (err) {
    console.error("Error fetching need parts by work ID:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};


exports.getIssueChartCounts = async (req, res) => {
  try {
    const result = await Work.aggregate([
      { $unwind: "$issues" },
      {
        $group: {
          _id: "$issues.status",
          count: { $sum: 1 }
        }
      }
    ]);

    let totalIssues = 0;

    const chartCounts = {
      on_hold: 0,      
      resolved: 0,
      unresolved: 0,
      other: 0
    };

    result.forEach(item => {
      totalIssues += item.count;

      if (item._id === "open") {
        chartCounts.on_hold = item.count; 
      } 
      else if (item._id === "resolved") {
        chartCounts.resolved = item.count;
      } 
      else if (item._id === "unresolved") {
        chartCounts.unresolved = item.count;
      } 
      else {
        chartCounts.other += item.count;
      }
    });

    res.status(200).json({
      success: true,
      totalIssues,
      data: chartCounts
    });

  } catch (err) {
    console.error("Issue Chart Count Error:", err);
    res.status(500).json({
      message: "Failed to fetch issue chart counts"
    });
  }
};



exports.getOrdersClientsGraph = async (req, res) => {
  try {
    const type = req.query.type || "day";
    const baseDate = req.query.date ? new Date(req.query.date) : new Date();

    let startDate, endDate, groupId, labelFn;
    let graphData = [];

    // ================= DAY =================
    if (type === "day") {
      startDate = new Date(baseDate);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(baseDate);
      endDate.setHours(23, 59, 59, 999);

      groupId = { hour: { $hour: "$createdAt" } };
      labelFn = (d) => `${d.hour}:00`;

      // generate 24 hours
      for (let h = 0; h < 24; h++) {
        graphData.push({ label: `${h}:00`, orders: 0, clients: 0 });
      }
    }

    // ================= WEEK =================
    else if (type === "week") {
      const d = new Date(baseDate);
      const day = d.getDay(); // 0 = Sunday

      // Monday of current week
      const monday = new Date(d);
      monday.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
      monday.setHours(0, 0, 0, 0);
      startDate = monday;

      // End date: clicked day if not Sunday, else Sunday
      const endOfWeek = new Date(d);
      endOfWeek.setHours(23, 59, 59, 999);
      endDate = day === 0 ? new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000) : endOfWeek;

      groupId = { day: { $dayOfMonth: "$createdAt" } };
      labelFn = (d) => `Day ${d.day}`;

      // generate week days (Mon -> clickedDay/Sunday)
      const temp = new Date(startDate);
      while (temp <= endDate) {
        graphData.push({
          day: temp.getDate(),
          label: `Day ${temp.getDate()}`,
          orders: 0,
          clients: 0
        });
        temp.setDate(temp.getDate() + 1);
      }
    }

    // ================= MONTH =================
    else if (type === "month") {
      startDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);

      groupId = { day: { $dayOfMonth: "$createdAt" } };
      labelFn = (d) => `Day ${d.day}`;

      // generate all days in month
      const temp = new Date(startDate);
      while (temp <= endDate) {
        graphData.push({
          day: temp.getDate(),
          label: `Day ${temp.getDate()}`,
          orders: 0,
          clients: 0
        });
        temp.setDate(temp.getDate() + 1);
      }
    }

    // ================= ORDERS =================
    const ordersAgg = await Work.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: groupId,
          orders: { $sum: 1 }
        }
      }
    ]);

    // ================= CLIENTS =================
    const clientsAgg = await User.aggregate([
      {
        $match: {
          role: "client",
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: groupId,
          clients: { $sum: 1 }
        }
      }
    ]);

    // ================= MERGE DATA =================
    graphData = graphData.map((item) => {
      // Merge orders
      const order = ordersAgg.find(o => {
        if (type === "day") return o._id.hour === parseInt(item.label);
        return o._id.day === item.day;
      });
      if (order) item.orders = order.orders;

      // Merge clients
      const client = clientsAgg.find(c => {
        if (type === "day") return c._id.hour === parseInt(item.label);
        return c._id.day === item.day;
      });
      if (client) item.clients = client.clients;

      return item;
    });

    res.status(200).json({
      success: true,
      type,
      date: baseDate,
      graphData
    });

  } catch (error) {
    console.error("Graph Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load graph data"
    });
  }
};


exports.getlinegraph=async(req,res)=>{
  try{
    const work =await Work.find();
    console.log(work)
    
  }catch(err){

  }
}

exports.getClientLedgerAdmin = async (req, res) => {
  try {
    const { clientId } = req.params;

    const cacheKey = `admin:ledger:${clientId}`;

    const ledger = await cache(
      cacheKey,
      async () => {
        const works = await Work.find({ client: clientId })
          .populate("client", "firstName lastName phone email")
          .populate("assignedTechnician", "firstName lastName phone")
          .sort({ createdAt: -1 });

        let totalBilled = 0;
        let totalPaid = 0;

        const history = works.map(work => {
          const invoiceTotal = work.invoice?.total || 0;
          const isPaid = work.payment?.status === "payment_done";

          totalBilled += invoiceTotal;
          if (isPaid) totalPaid += invoiceTotal;

          return {
            workId: work._id,
            workToken: work.token,
            serviceType: work.serviceType,
            status: work.status,

            technician: work.assignedTechnician
              ? {
                  name: `${work.assignedTechnician.firstName} ${work.assignedTechnician.lastName}`,
                  phone: work.assignedTechnician.phone
                }
              : null,

            invoice: {
              invoiceNumber: work.invoice?.invoiceNumber || null,
              total: invoiceTotal,
              pdfUrl: work.invoice?.pdfUrl || null
            },

            payment: {
              method: work.payment?.method || null,
              status: work.payment?.status || "pending",
              paidAt: work.payment?.paidAt || null
            },

            createdAt: work.createdAt,
            completedAt: work.completedAt
          };
        });

        return {
          client: works[0]?.client || null,
          summary: {
            totalWorks: works.length,
            totalBilled,
            totalPaid,
            totalPending: totalBilled - totalPaid
          },
          history
        };
      },
      120 
    );

    res.status(200).json({
      success: true,
      ledger
    });

  } catch (err) {
    console.error("Get client ledger error", err);
    res.status(500).json({
      success: false,
      message: "Unable to fetch client ledger"
    });
  }
};


