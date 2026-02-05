const mongoose= require('mongoose')
const Work = require("../model/work");
const User = require("../model/user");
const Booking=require("../model/BookOrder")
const AdminNotification=require('../model/adminnotification')
const { sendNotification } = require("../controllers/helpercontroller");
const admin = require("firebase-admin");
const Newsletter = require("../model/sub");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");
const sendemail=require('../utils/sendemail')
const projectRoot = process.cwd();
const invoicesFolder = path.join(projectRoot, "invoices");

const { uploadToCloudinary } = require("../utils/cloudinaryUpload");

const {
  emitWorkStatus,
  emitTechnicianLocation
} = require("../utils/socketEmitter");


const generateToken = (id) => {
  return `REQ-${new Date().getFullYear()}-${String(id).padStart(5, '0')}`;
};





function parseClientDate(input) {
  if (!input) return null;
  input = input.replace(/\//g, "-");
  const [d, m, y] = input.split("-");
  if (!d || !m || !y) return null;

  const day = d.padStart(2, "0");
  const month = m.padStart(2, "0");

  const isoDate = `${y}-${month}-${day}`;
  const objectDate = new Date(isoDate);
  if (isNaN(objectDate.getTime())) return null;

  return {
    iso: isoDate,
    formatted: `${day}-${month}-${y}`,
    objectDate,
  };
}

async function getAddressFromCoordinates(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
    const response = await axios.get(url, {
      timeout: 3000,
      headers: { "User-Agent": "MyApp/1.0" },
    });
    return response.data.display_name || null;
  } catch {
    return null;
  }
}

async function getCoordinatesFromAddress(address) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      address
    )}&format=json&limit=1`;

    const response = await axios.get(url, {
      timeout: 4000,
      headers: { "User-Agent": "MyApp/1.0" },
    });

    if (!response.data || response.data.length === 0) return null;

    return {
      lat: parseFloat(response.data[0].lat),
      lng: parseFloat(response.data[0].lon),
      displayName: response.data[0].display_name,
    };
  } catch {
    return null;
  }
}


exports.createWork = async (req, res) => {
  try {
    const {
      serviceType,
      specialization,
      description,
      serviceCharge,
      technicianId,
      lat,
      lng,
      manualLocation,
      date
    } = req.body;

    const clientId = req.user._id;

    if (!serviceType || !specialization) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const client = await User.findById(clientId);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }


    const specs = Array.isArray(specialization)
      ? specialization.map(s => s.trim().toLowerCase())
      : specialization.split(",").map(s => s.trim().toLowerCase());

   
    const parsedDate = date ? parseClientDate(date) : null;
    if (date && !parsedDate) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    if (parsedDate) parsedDate.objectDate.setHours(0, 0, 0, 0);

   
    let finalLat, finalLng;
    let resolvedLocation = "unknown";
    let savedManualLocation = null;

    
    if (lat != null && lng != null) {
      finalLat = lat;
      finalLng = lng;

      const name = await getAddressFromCoordinates(lat, lng);
      resolvedLocation = name ? name.toLowerCase() : "unknown";
    }

   
    else if (manualLocation) {
      const geo = await getCoordinatesFromAddress(manualLocation);

      if (!geo) {
        return res.status(400).json({
          message: "Unable to fetch coordinates from manual address",
        });
      }

      finalLat = geo.lat;
      finalLng = geo.lng;
      resolvedLocation = geo.displayName.toLowerCase();
      savedManualLocation = manualLocation;
    }


    else {
      return res.status(400).json({ message: "Location is required" });
    }

    
    const technicians = await User.find({
      role: "technician",
      specialization: { $in: specs },
    });

    if (!technicians.length) {
      return res.status(404).json({
        message: "No technician available for the selected specialization",
      });
    }

   
    let bookedTechIds = [];

    if (parsedDate) {
      const dayStart = new Date(parsedDate.objectDate);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(parsedDate.objectDate);
      dayEnd.setHours(23, 59, 59, 999);

      const bookedWorks = await Work.find({
        date: { $gte: dayStart, $lte: dayEnd },
        assignedTechnician: { $ne: null },
        status: { $in: ["open", "approved", "dispatch", "inprogress"] },
      }).select("assignedTechnician");

      const bookedBookings = await Booking.find({
        date: { $gte: dayStart, $lte: dayEnd },
        status: { $in: ["Requested", "approved", "dispatch", "inprogress"] },
      }).select("technician");

      bookedTechIds = [
        ...bookedWorks.map(w => w.assignedTechnician.toString()),
        ...bookedBookings.map(b => b.technician.toString()),
      ];
    }

  
    const R = 6371;
    const matchingTechnicians = [];

    for (const tech of technicians) {
      if (!tech.coordinates?.lat || !tech.coordinates?.lng) continue;
      if (bookedTechIds.includes(tech._id.toString())) continue;

      const dLat = ((tech.coordinates.lat - finalLat) * Math.PI) / 180;
      const dLng = ((tech.coordinates.lng - finalLng) * Math.PI) / 180;

      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((finalLat * Math.PI) / 180) *
          Math.cos((tech.coordinates.lat * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;

      const distance = R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));

      if (distance <= 70) {
        matchingTechnicians.push({
          ...tech.toObject(),
          distanceInKm: distance.toFixed(2),
          employeeStatus: "available",
        });
      }
    }

    if (!matchingTechnicians.length) {
      return res.status(404).json({
        message: "No technician available for this location",
      });
    }


    let assignedTech = null;

if (technicianId && mongoose.Types.ObjectId.isValid(technicianId)) {
  const validTech = matchingTechnicians.find(
    t => t._id.toString() === technicianId
  );

  if (!validTech) {
    return res.status(400).json({
      message: "Selected technician is already booked",
    });
  }

  assignedTech = technicianId;
}

  
    const work = await Work.create({
      client: clientId,
      serviceType,
      specialization: specs,
      description,
      serviceCharge: serviceCharge || 0,

      location: resolvedLocation,
      manualLocation: savedManualLocation,
      coordinates: { lat: finalLat, lng: finalLng },

      assignedTechnician: assignedTech,
      status: "open",
      token: `REQ-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
      date: parsedDate ? parsedDate.objectDate : null,
      formattedDate: parsedDate ? parsedDate.formatted : null,
    });
    emitWorkStatus(work);
// console.log(work)
    res.status(201).json({
      message: "Work request submitted successfully",
      work,
      matchingTechnicians,
    });

  } catch (err) {
    console.error("Work Creation Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};





exports.bookTechnician = async (req, res) => {
  try {
    const {
      workId,
      technicianId,
      lat,
      lng,
      date,
      time,
      serviceType,
      serviceCharge,
      description,
    } = req.body;

    const userId = req.user._id;

    
    if (!mongoose.Types.ObjectId.isValid(workId))
      return res.status(400).json({ message: "Invalid Work ID" });

    if (!mongoose.Types.ObjectId.isValid(technicianId))
      return res.status(400).json({ message: "Invalid Technician ID" });

    if (lat == null || lng == null)
      return res.status(400).json({ message: "Coordinates required" });

    if (!date || !time)
      return res.status(400).json({ message: "Date and time are required" });

    const parsedDate = parseClientDate(date);
    if (!parsedDate)
      return res.status(400).json({ message: "Invalid date format (DD-MM-YYYY)" });

 
    parsedDate.objectDate.setHours(0, 0, 0, 0);

 
    const timeConflict = await Booking.findOne({
      technician: technicianId,
      date: parsedDate.objectDate,
      formattedTime: time,
      status: { $in: ["Requested", "approved", "on_the_way", "inprogress"] }
    });

    if (timeConflict) {
      return res.status(400).json({
        message: `Technician already booked on ${parsedDate.formatted} at ${time}`
      });
    }

    console.log(req.body)
    const lockedWork = await Work.findOneAndUpdate(
      {
        _id: workId,
        assignedTechnician: { $in: [null, undefined] }
      },
      {
        assignedTechnician: technicianId,
        status: "approved"
      

      },
      { new: true }
    );
  emitWorkStatus(lockedWork);
    // if (!lockedWork) {
    //   return res.status(400).json({
    //     message: "This work has already been booked"
    //   });
    // }


    const [client, technician] = await Promise.all([
      User.findById(userId).select("firstName address"),
      User.findById(technicianId).select("firstName")
    ]);

    if (!client)
      return res.status(404).json({ message: "Client not found" });

    if (!technician)
      return res.status(404).json({ message: "Technician not found" });

    const existingBooking = await Booking.findOne({
      user: userId,
      technician: technicianId,
      serviceType,
      status: { $in: ["Requested", "approved", "on_the_way", "inprogress"] }
    });

    if (existingBooking) {
      return res.status(400).json({
        message: `You already have an active booking with ${technician.firstName}`,
        bookingId: existingBooking._id
      });
    }

    const booking = await Booking.create({
      user: userId,
      technician: technicianId,
      serviceType,
      serviceCharge: Number(serviceCharge || 0),
      description,
      location: "",
      coordinates: { lat, lng },
      address: client.address || "Not available",
      date: parsedDate.objectDate,
      formattedDate: parsedDate.formatted,
      formattedTime: time,
      status: "open"
    });
    
    res.status(201).json({
      message: "Technician booked successfully",
      booking,
      work: lockedWork
    });

 console.log(res)
    getAddressFromCoordinates(lat, lng).then(address => {
      if (address) {
        Booking.updateOne(
          { _id: booking._id },
          { location: address.toLowerCase() }
        ).exec();

        Work.updateOne(
          { _id: workId },
          { location: address.toLowerCase() }
        ).exec();
      }
    });

    // sendNotification(
    //   technicianId,
    //   "technician",
    //   "New Work Assigned",
    //   `You have received a new work request from ${client.firstName}`,
    //   "new_work",
    //   `work-${lockedWork.token}`
    // );

    // sendNotification(
    //   userId,
    //   "client",
    //   "Requested",
    //   `Your technician ${technician.firstName} has been booked successfully`,
    //   "Requested",
    //   `work-${lockedWork.token}`
    // );

  } catch (err) {
    console.error("Book Technician Error:", err);
    return res.status(500).json({
      message: "Server error while booking technician"
    });
  }
};



exports.WorkStart = async (req, res) => {
  try {
    const { workId } = req.body;
    const technicianId = req.user._id;
    // const beforePhoto = req.file;
    if (!workId) {
      return res.status(400).json({ message: "Work ID is required" });
    }
    const gettoken=await Work.findById(workId).select("token")
    const work = await Work.findById(workId);
    if (!work) {
      return res.status(404).json({ message: "Work not found" });
    }

    if (String(work.assignedTechnician) !== String(technicianId)) {
      return res.status(403).json({ message: "You are not assigned to this work" });
    }

   
    // let beforePhotoUrl = "";
    // if (beforePhoto) {
     
    //   const uploadRes = await uploadToCloudinary(beforePhoto.path, "work_before_photos");
    //   beforePhotoUrl = uploadRes.secure_url;

    //   // OR if local:
    //   // beforePhotoUrl = `/uploads/${beforePhoto.filename}`;
    // }


    work.status = "inprogress";
    work.startedAt = new Date();
    // work.beforephoto = beforePhotoUrl; 
    await work.save(); 
    
emitWorkStatus(work);
  // changeStatus(work);
//     await sendNotification(
//   work.client._id, 
//   "client", 
//   "Work Started", 
//   `Technician has started your work: ${work.serviceType}`,
//   "work_started",
//   `work${gettoken.token}`
// );

    await User.findByIdAndUpdate(technicianId, {
      technicianStatus: "inprogress",
      onDuty: true,
      availability: false,
    });
// await sendNotification(
//   technicianId,
//   "technician",
//   "Job Status Updated",
//   `You have started work (${work.serviceType}).`,
//   "info",
//   `/technician/work/${work._id}`
// );

// await sendNotification(
//   work.client,
//   "client",
//   "Work In Progress",
//   `Your job (${work.serviceType}) has been marked as in-progress.`,
//   "info",
//   `/client/work/${work._id}`
// );

   
    await Booking.findOneAndUpdate(
      { technician: technicianId, user: work.client, status: { $in: ["open",  "on_the_way", "dispatch"] } },
      { status: "inprogress" }
    );

    res.status(200).json({
      message: "Technician started the work. Status set to in-progress.",
      work,
      // beforePhoto: beforePhotoUrl,
    });
  } catch (err) {
    console.error("❌ Work Start Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


exports.updateLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const technicianId = req.user._id;

    if (!lat || !lng) {
      return res
        .status(400)
        .json({ message: "Latitude and longitude required" });
    }

   
    const work = await Work.findOne({
      assignedTechnician: technicianId,
      status: { $in: ["approved", "dispatch", "on_the_way", "inprogress"] },
    }).populate("client", "coordinates name phone email");

    if (!work) {
      return res.status(403).json({
        message: "No active work found for technician",
      });
    }

   
    await User.findByIdAndUpdate(technicianId, {
      coordinates: { lat, lng },
      lastLocationUpdate: new Date(),
      onDuty: true,
    });

   
    if (work.status === "approved") {
      work.status = "dispatch";
      await work.save();
    }

    

    const clientLat =
      work.coordinates?.lat || work.client.coordinates?.lat;
    const clientLng =
      work.coordinates?.lng || work.client.coordinates?.lng;

    let eta = null;
    let distance = null;
    let polyline = null;

if(global.io){
      global.io.emit(`track-${technicianId}`, {
        workId: work._id,
        lat,
        lng,
        time: Date.now(),
      });
}


    
    if (clientLat && clientLng) {
      const origin = `${lat},${lng}`;
      const destination = `${clientLat},${clientLng}`;

      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=driving&key=${process.env.GOOGLE_MAPS_API_KEY}`;

      const response = await axios.get(url);
      const data = response.data;

      if (data.status === "OK" && data.routes.length) {
        const leg = data.routes[0].legs[0];
        eta = Math.round(leg.duration.value / 60); // ✅ ETA in minutes
        distance = leg.distance.text;
        polyline = data.routes[0].overview_polyline.points;
      }
    }

    // 

    if (global.io) {
     
   

      
      global.io.emit(`technician_eta_update-${technicianId}`, {
          workId: work._id,
          technicianId,
          location: { lat, lng },
          status: work.status,
          eta,         
          distance,     
          polyline,     
          updatedAt: Date.now(),
        });
    }



    return res.status(200).json({
      message: "Technician location updated successfully",
      workStatus: work.status,
      eta,         
      distance,     
    });
  } catch (err) {
    console.error("Update Location Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};



exports.trackTechnician = async (req, res) => {
  try {
    const { workId } = req.params;
    const work = await Work.findById(workId).populate("assignedTechnician");

    if (!work || !work.assignedTechnician) {
      return res.status(404).json({ message: "Technician not assigned yet" });
    }

    const technician = work.assignedTechnician;
    const client = await User.findById(work.client);


    const clientLat = work.coordinates?.lat || client.coordinates?.lat;
    const clientLng = work.coordinates?.lng || client.coordinates?.lng;

    if (
      !technician.coordinates?.lat ||
      !technician.coordinates?.lng ||
      !clientLat ||
      !clientLng
    ) {
      return res.status(400).json({
        message: "Missing coordinates for route calculation",
      });
    }

    const googleKey = process.env.GOOGLE_MAPS_API_KEY;
    const origin = `${technician.coordinates.lat},${technician.coordinates.lng}`;
    const destination = `${clientLat},${clientLng}`;

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=driving&alternatives=true&key=${googleKey}`;

    const response = await axios.get(url);
    const data = response.data;

    if (data.status !== "OK") {
      return res.status(400).json({
        message: `Google Directions API error: ${data.status}`,
      });
    }

 
    const selectedRouteIndex = work.selectedRouteIndex ?? 0;

    const route = data.routes[selectedRouteIndex];
    const leg = route.legs[0];

    const etaSeconds = leg.duration.value;
    const distanceText = leg.distance.text;
    const minutes = Math.round(etaSeconds / 60);
    //        if (global.io) {
    //   global.io.to(String(client._id)).emit("technician_eta_update", {
    //     workId: work._id,
    //     technicianId: technician._id,
    //     status: work.status,
    //     etaMinutes: minutes,
    //     distance: distanceText,
    //     polyline: route.overview_polyline.points,
    //     routeSummary: route.summary,
    //     timestamp: Date.now(),
    //   });
    // }

    res.status(200).json({
      technician: {
        name: technician.name,
        coordinates: technician.coordinates,
        lastUpdate: technician.lastLocationUpdate,
        liveStatus: work.status,
      },
      client: {
        name: client.name,
        coordinates: { lat: clientLat, lng: clientLng },
      },

      eta: `${minutes} minutes`,
      distance: distanceText,


      polyline: route.overview_polyline.points,

      allRoutes: data.routes.map((r, i) => ({
        index: i,
        summary: r.summary,
        distance: r.legs[0].distance.text,
        duration: r.legs[0].duration.text,
      })),
    });

  } catch (err) {
    console.error("Track Technician Error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};




exports.getClientWorkStatus = async (req, res) => {
  try {
    const { workId } = req.params;
    const clientId = req.user._id;

    const work = await Work.findById(workId)
      .populate("assignedTechnician", "firstName lastName phone email technicianStatus coordinates lastLocationUpdate")
      .populate("client", "firstName lastName phone email")
      .populate("billId"); // Populate billId so we can read UPI link

    if (!work) return res.status(404).json({ message: "Work not found" });
    if (String(work.client._id) !== String(clientId)) {
      return res.status(403).json({ message: "Not authorized to view this work" });
    }

    const technician = work.assignedTechnician;
    let eta = "ETA not available";

    if (technician?.coordinates?.lat && technician?.coordinates?.lng &&
        work.coordinates?.lat && work.coordinates?.lng) {
      try {
        const orsKey = process.env.ORS_KEY;
        const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${orsKey}&start=${technician.coordinates.lng},${technician.coordinates.lat}&end=${work.coordinates.lng},${work.coordinates.lat}`;
        const response = await axios.get(url);
        const seconds = response.data.features[0].properties.summary.duration;
        const minutes = Math.round(seconds / 60);
        eta = `${minutes} minutes`;
      } catch (err) {
        console.log("ETA calc failed:", err.message);
      }
    }

    const workStatus = {
      workId: work._id,
      token: work.token,
      serviceType: work.serviceType,
      specialization: work.specialization,
      serviceCharge: work.serviceCharge,
      totalAmount: work.totalAmount,
      description: work.description,
      location: work.location,
      status: work.status,
      createdAt: work.createdAt,
      startedAt: work.startedAt,
      completedAt: work.completedAt,
      afterPhoto: work.afterphoto,
      client: {
        name: work.client.name,
        phone: work.client.phone,
        email: work.client.email,
      },
      technician: technician ? {
        name: technician.firstName,
        phone: technician.phone,
        email: technician.email,
        status: technician.technicianStatus,
        coordinates: technician.coordinates,
        lastUpdate: technician.lastLocationUpdate,
      } : null,
      eta,
      payment: work.billId ? {
        upiUri: work.billId.upiUri || null,
        clickableUPI: work.billId.clickableUPI || null,
        qrImage: work.billId.qrImage || null,
        expiresAt: work.billId.expiresAt || null
      } : null
    };

    return res.status(200).json({
      message: "Work status fetched successfully",
      workStatus
    });

  } catch (err) {
    console.error("Client Work Status Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};



exports.reportWorkIssue = async (req, res) => {
  try {
    const { workId, issueType, remarks } = req.body;
    const technicianId = req.user._id;

    if (!workId || !issueType) {
      return res.status(400).json({ message: "Work ID and issue type required" });
    }

    const work = await Work.findById(workId).populate("client");
    if (!work) return res.status(404).json({ message: "Work not found" });

    if (String(work.assignedTechnician) !== String(technicianId)) {
      return res.status(403).json({ message: "You are not assigned to this work" });
    }

 
    switch (issueType) {
      case "need_parts":
        work.status = "onhold_parts";
        work.remarks = remarks || "Parts required for repair";
        await work.save();

        console.log(`Parts required for Work ID: ${workId}`);
        break;

      case "need_specialist":
        work.status = "escalated";
        work.remarks = remarks || "Requires senior technician";
        await work.save();

        console.log(`Escalated to supervisor for Work ID: ${workId}`);
        break;

      case "customer_unavailable":
        work.status = "rescheduled";
        work.remarks = remarks || "Customer not available at site";
        await work.save();

        console.log(`Work rescheduled due to customer unavailability`);
        break;

      default:
        return res.status(400).json({ message: "Invalid issue type" });
    }

    
    try {
      await AdminNotification.create({
        type: "work_issue",
        message: `Technician ${req.user.name || technicianId} reported an issue (${issueType}) for work ${work._id}`,
        work: work._id,
        technician: technicianId,
        issueType,
        remarks: remarks || ""
      });
      console.log(`✅ Admin notified about issue ${issueType} for Work ${workId}`);
    } catch (notifErr) {
      console.error("❌ Admin notification creation failed:", notifErr.message);
    }

    
    await Booking.findOneAndUpdate(
      { technician: technicianId, user: work.client._id },
      { status: work.status }
    );

    await User.findByIdAndUpdate(technicianId, {
      technicianStatus: "pending",
      availability: true
    });


    return res.status(200).json({
      message: "Work issue reported successfully.",
      workStatus: work.status,
      remarks: work.remarks
    });

  } catch (err) {
    console.error("Report Work Issue Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
 



exports.getAdminNotifications = async (req, res) => {
  
  try {
    const notifications = await AdminNotification.find()
      .sort({ createdAt: -1 })
      .populate("work", "serviceType status location")
      .populate("technician", "name email phone");

    if (!notifications.length) {
      return res.status(200).json({ message: "No notifications found", notifications: [] });
    }

    res.status(200).json({
      message: "Admin notifications fetched successfully",
      count: notifications.length,
      notifications
    });
  } catch (err) {
    console.error("Get Admin Notifications Error:", err.message);
    res.status(500).json({ message: "Server error while fetching notifications" });
  }
};



exports.payBill = async (req, res) => {
  try {
    const { workId, paymentMethod, paymentStatus } = req.body; 
    const clientId = req.user._id;

    const work = await Work.findById(workId).populate("client");
    if (!work) return res.status(404).json({ message: "Work not found" });

    if (String(work.client._id) !== String(clientId))
      return res.status(403).json({ message: "Unauthorized" });

    if (work.status !== "completed")
      return res.status(400).json({ message: "Work not completed yet" });

   
    work.payment = {
      method: paymentMethod,
      status: paymentStatus || "pending",
      paidAt: new Date(),
    };
    await work.save();
// await sendNotification(
//   work.client,
//   "client",
//   "Payment Successful",
//   `Payment received for work ID: ${work._id}`,
//   "success",
//   `/client/work/${work._id}`
// );

    
    await sendemail(
      work.client.email,
      `Payment Confirmation - ${work.invoice.invoiceNumber}`,
      `<p>Hello ${work.client.firstName},</p>
       <p>We’ve received your payment of ₹${work.invoice.total.toFixed(2)} via ${paymentMethod.toUpperCase()}.</p>
       <p>Your final invoice is attached below.</p>`,
      work.invoice.pdfUrl
    );

    res.status(200).json({
      message: "Payment processed and final invoice sent to client email.",
      payment: work.payment,
    });
  } catch (err) {
    console.error("Payment Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
exports.confirmPayment = async (req, res) => {
  try {
    const { workId, paymentMethod } = req.body;
    const technicianId = req.user._id;
     const gettoken=await Work.findById(workId).select("token");
    const work = await Work.findById(workId)
      .populate("client", "firstName email")
      .populate("technician", "firstName _id");

    if (!work) return res.status(404).json({ message: "Work not found" });

   
    if (String(work.technician._id) !== String(technicianId))
      return res.status(403).json({ message: "Unauthorized: not your assigned work" });

   
    if (work.status !== "completed")
      return res.status(400).json({ message: "Work must be completed before confirming payment" });

 
    if (!["cash", "upi"].includes(paymentMethod))
      return res.status(400).json({ message: "Invalid payment method" });


    work.payment = {
      method: paymentMethod,
      status: "payment_done" || "confirm",
      confirmedBy: technicianId,
      confirmedAt: new Date(),
    };
    await work.save();

  changeStatus(work);

    await sendNotification(
      work.client._id,
      "client",
      "Payment Confirmed",
      `Technician has confirmed your payment for the service: ${work.serviceType} by ${paymentMethod}`,
      "payment_done" || "confirm",
      `work-${gettoken.token}`
    );
    res.status(200).json({
      message: "Payment confirmed successfully.",
      payment: work.payment,
    });
  } catch (err) {
    console.error("Confirm Payment Error:", err);
    res.status(500).json({ message: "Server error while confirming payment." });
  }
};
exports.saveLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const userId = req.user._id;

    if (!lat || !lng)
      return res.status(400).json({ message: "Latitude and longitude required" });


    await User.findByIdAndUpdate(userId, {
      coordinates: { lat, lng },
      lastLocationUpdate: new Date(),
    });

    res.status(200).json({
      success: true,
      message: "Location saved successfully",
      coordinates: { lat, lng },
    });
  } catch (error) {
    console.error("Save Location Error:", error);
    res.status(500).json({ message: "Failed to save location" });
  }
};


exports.getLocation = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || !user.coordinates)
      return res.status(404).json({ message: "No saved location found" });

    res.status(200).json({
      success: true,
      coordinates: user.coordinates,
      lastUpdated: user.lastLocationUpdate,
    });
  } catch (error) {
    console.error("Get Location Error:", error);
    res.status(500).json({ message: "Failed to fetch location" });
  }
};


exports.getRoutes = async (req, res) => {
  try {
    const { techLat, techLng, clientLat, clientLng } = req.body;

    const googleKey = process.env.GOOGLE_MAPS_API_KEY;

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${techLat},${techLng}&destination=${clientLat},${clientLng}&mode=driving&alternatives=true&key=${googleKey}`;

    const response = await axios.get(url);
    const data = response.data;

    if (data.status !== "OK") {
      return res.status(400).json({ message: "Google Directions API Error" });
    }

    res.status(200).json({
      routes: data.routes.map((route, index) => ({
        index,
        summary: route.summary,
        distance: route.legs[0].distance.text,
        duration: route.legs[0].duration.text,
        polyline: route.overview_polyline.points,
      })),
    });

  } catch (err) {
    console.error("Get Routes Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.selectRoute = async (req, res) => {
  try {
    const { workId } = req.params;
    const { selectedRouteIndex } = req.body;

    const work = await Work.findById(workId);
    if (!work) return res.status(404).json({ message: "Work not found" });

    work.selectedRouteIndex = selectedRouteIndex;
    await work.save();

    res.status(200).json({
      message: "Route selected successfully",
      selectedRouteIndex
    });

  } catch (err) {
    console.error("Select Route Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};






exports.subscribe = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    
    const exist = await Newsletter.findOne({ email });
    if (exist) {
      return res.status(200).json({ message: "Already subscribed!" });
    }

  
    await Newsletter.create({ email });

    
    await sendemail(
      email,
      "You're Subscribed! 🎉",
      `
        <h2>Welcome to Our Newsletter ❤️</h2>
        <p>Thank you for subscribing. You'll now receive updates directly from us.</p>
      `
    );

    return res.status(200).json({
      success: true,
      message: "Subscribed successfully & email sent!"
    });

  } catch (error) {
    console.error("Newsletter Error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};


exports.sendBulkEmail = async (req, res) => {
  try {
    const { subject, message } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ message: "Subject and message required" });
    }

    const subscribers = await Newsletter.find({}, "email");

    if (subscribers.length === 0) {
      return res.status(400).json({ message: "No subscribers found" });
    }

 
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.ADMIN_EMAIL,
        pass: process.env.ADMIN_PASSWORD,
      },
    });

    for (let sub of subscribers) {
      const mailOptions = {
        from: process.env.ADMIN_EMAIL,
        to: sub.email,
        subject,
        html: `
          <div style="font-family: Arial; padding: 10px;">
            <h2>${subject}</h2>
            <p>${message}</p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
    }

    res.status(200).json({
      success: true,
      message: "Bulk emails sent successfully!",
      count: subscribers.length,
    });

  } catch (error) {
    console.error("Bulk Email Error:", error);
    res.status(500).json({ message: "Failed to send bulk emails" });
  }
};

exports.getSubscribers = async (req, res) => {
  try {
    const list = await Newsletter.find().sort({ subscribedAt: -1 });
    res.status(200).json({ success: true, subscribers: list });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch subscribers" });
  }
};
exports.generatePaymentRecei = async (req, res) => {
  try {
    const { workId } = req.params;
    const userId = req.user._id;

    const work = await Work.findById(workId).populate("client assignedTechnician");

    if (!work) {
      return res.status(404).json({ message: "Work not found" });
    }

    
    if (String(work.client._id) !== String(userId)) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    if (work.payment?.status !== "payment_done" || "confirm") {
      return res.status(400).json({ message: "Payment not completed yet" });
    }

    const receiptPath = path.join(
      invoicesFolder,
      `payment_receipt_${work.token}.pdf`
    );

    if (!fs.existsSync(receiptPath)) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    res.download(
      receiptPath,
      `Invoice_${work.token}.pdf`
    );

  } catch (err) {
    console.error("Download Invoice Error:", err);
    res.status(500).json({ message: "Failed to download invoice" });
  }
};



exports.cancelOrder = async (req, res) => {
  try {
    const clientId = req.user._id;
    const { workId } = req.params;
    const { cancelReason } = req.body;

    if (!cancelReason) {
      return res.status(400).json({
        success: false,
        message: "Cancel reason is required",
      });
    }

    const work = await Work.findById(workId);

    if (!work) {
      return res.status(404).json({
        success: false,
        message: "Work not found",
      });
    }

    
    if (work.client.toString() !== clientId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to cancel this order",
      });
    }

  
    work.status = "cancelled";
    work.cancelReason = cancelReason;
    work.cancelledBy = "client";
    work.cancelledAt = new Date();

    await work.save();

    

    await sendNotification(
      work.technician,
      "technician",
      "Order Cancelled",
      `Client has cancelled the order. Reason: ${cancelReason}`,
      "order_cancelled",
      `work-${work._id}`
    );

    const technicianUser = await User.findById(work.technician).select(
      "fcmToken"
    );

    if (technicianUser?.fcmToken) {
      await admin.messaging().send({
        token: technicianUser.fcmToken,
        notification: {
          title: "Order Cancelled",
          body: `Client cancelled the order. Reason: ${cancelReason}`,
        },
        data: {
          type: "ORDER_CANCELLED",
          link: `work-${work._id}`,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.rescheduleOrder = async (req, res) => {
  try {
    const clientId = req.user._id;
    const { workId } = req.params;

    const work = await Work.findById(workId);

    if (!work) {
      return res.status(404).json({
        success: false,
        message: "Work not found",
      });
    }

    if (work.client.toString() !== clientId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to reschedule this order",
      });
    }

   
    const oldTechnicianId = work.technician || work.assignedTechnician;

  
    work.status = "rescheduled";
    work.rescheduledAt = new Date();
    await work.save();

 
    if (oldTechnicianId) {
      const message =
        "Client has rescheduled this job. This job is no longer active.";

      await sendNotification(
        oldTechnicianId,
        "technician",
        "Job Rescheduled",
        message,
        "job_rescheduled",
        `work-${work._id}`
      );

      const technicianUser = await User.findById(oldTechnicianId).select(
        "fcmToken"
      );

      if (technicianUser?.fcmToken) {
        await admin.messaging().send({
          token: technicianUser.fcmToken,
          notification: {
            title: "Job Rescheduled",
            body: message,
          },
          data: {
            type: "JOB_RESCHEDULED",
            workId: work._id.toString(),
          },
        });
      }
    }

 
    return res.status(200).json({
      success: true,
      message: "Redirect to create work",
      redirectTo: "CREATE_WORK",
      workData: {
        serviceType: work.serviceType,
        specialization: work.specialization,
        description: work.description,
        serviceCharge: work.serviceCharge,

        lat: work.coordinates?.lat,
        lng: work.coordinates?.lng,
        manualLocation: work.manualLocation,

        date: work.formattedDate,
      },
    });

  } catch (err) {
    console.error("Reschedule Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
