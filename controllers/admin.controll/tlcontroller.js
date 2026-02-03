const Work = require('../../model/work');
const User = require('../../model/user');

exports.monitortech = async (req, res) => {
  try {
    const { technicianId } = req.params;

    if (!technicianId) {
      return res.status(400).json({
        success: false,
        message: "Technician ID is required"
      });
    }

    const workdetails = await Work.find({ technician: technicianId })
      .select("title status priority createdAt")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      totalWorks: workdetails.length,
      workdetails
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
};


exports.checkstatus = async (req, res) => {
  try {
    const tlId = req.user._id; // logged-in TL

    const technicians = await User.find(
      {
        role: "technician",
        assignedTL: tlId,
        isActive: true
      },
      "firstName technicianStatus coordinates lastLocationUpdate"
    ).lean();

    const summary = {
      totalTechnicians: technicians.length,
      available: 0,
      working: 0,
      dispatched: 0,
      onBreak: 0,
      offDuty: 0
    };

    technicians.forEach(t => {
      if (t.technicianStatus === "available") summary.available++;
      if (t.technicianStatus === "working") summary.working++;
      if (t.technicianStatus === "dispatched") summary.dispatched++;
      if (t.technicianStatus === "break") summary.onBreak++;
      if (t.technicianStatus === "offDuty") summary.offDuty++;
    });

    res.status(200).json({
      success: true,
      summary,
      technicians
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};


exports.assignTechnicianToTL = async (req, res) => {
  try {
    const { technicianId, tlId } = req.body;

    if (!technicianId || !tlId) {
      return res.status(400).json({
        success: false,
        message: "Technician ID and TL ID are required"
      });
    }

    const tl = await User.findOne({ _id: tlId, role: "TL" });
    if (!tl) {
      return res.status(404).json({
        success: false,
        message: "TL not found"
      });
    }

    const technician = await User.findOneAndUpdate(
      { _id: technicianId, role: "technician" },
      { assignedTL: tlId },
      { new: true }
    );

    if (!technician) {
      return res.status(404).json({
        success: false,
        message: "Technician not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Technician assigned to TL successfully",
      technician
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};


exports.gettechsearch = async (req, res) => {
  try {
    const { search = "", status } = req.query;
    const tlId = req.user._id;

    const query = {
      role: "technician",
      assignedTL: tlId
    };

    if (status) {
      query.technicianStatus = status;
    }

    if (search) {
      query.firstName = { $regex: search, $options: "i" };
    }

    const technicians = await User.find(
      query,
      "firstName technicianStatus coordinates lastLocationUpdate"
    );

    res.status(200).json({
      success: true,
      total: technicians.length,
      technicians
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};
