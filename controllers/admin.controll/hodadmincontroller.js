const Work = require('../../model/work');
const User = require('../../model/user');


exports.monitorTL = async (req, res) => {
  try {
    const { tlId } = req.params;

    const tl = await User.findOne({ _id: tlId, role: "TL" });
    if (!tl) {
      return res.status(404).json({
        success: false,
        message: "TL not found"
      });
    }

    const works = await Work.find({ assignedTL: tlId })
      .select("title status priority createdAt")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      totalWorks: works.length,
      works
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
};


exports.checkTLStatus = async (req, res) => {
  try {
    const hodId = req.user._id;

    const tls = await User.find(
      {
        role: "TL",
        assignedHOD: hodId,
        isActive: true
      },
      "firstName technicianStatus coordinates lastLocationUpdate"
    ).lean();

    const summary = {
      totalTLs: tls.length,
      available: 0,
      working: 0,
      dispatched: 0,
      onBreak: 0,
      offDuty: 0
    };

    tls.forEach(tl => {
      if (tl.technicianStatus === "available") summary.available++;
      if (tl.technicianStatus === "working") summary.working++;
      if (tl.technicianStatus === "dispatched") summary.dispatched++;
      if (tl.technicianStatus === "break") summary.onBreak++;
      if (tl.technicianStatus === "offDuty") summary.offDuty++;
    });

    res.status(200).json({
      success: true,
      summary,
      tls
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
};


exports.assignTLToHOD = async (req, res) => {
  try {
    const { tlId } = req.body;
    const hodId = req.user._id;

    const tl = await User.findOneAndUpdate(
      { _id: tlId, role: "TL" },
      { assignedHOD: hodId },
      { new: true }
    );

    if (!tl) {
      return res.status(404).json({
        success: false,
        message: "TL not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "TL assigned to HOD successfully",
      tl
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
};


exports.searchTL = async (req, res) => {
  try {
    const { search = "", status } = req.query;
    const hodId = req.user._id;

    const query = {
      role: "TL",
      assignedHOD: hodId
    };

    if (status) query.technicianStatus = status;
    if (search) query.firstName = { $regex: search, $options: "i" };

    const tls = await User.find(
      query,
      "firstName technicianStatus coordinates lastLocationUpdate"
    );

    res.status(200).json({
      success: true,
      total: tls.length,
      tls
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
};
