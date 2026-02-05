// utils/socketEmitter.js
exports.emitWorkStatus = (work) => {
  if (!global.io) return;

  global.io.to(`work-${work._id}`).emit("work_status_update", {
    workId: work._id,
    status: work.status,
    updatedAt: Date.now(),
  });
};

exports.emitTechnicianLocation = ({
  workId,
  lat,
  lng,
  status,
  eta,
  distance,
  polyline,
}) => {
  if (!global.io) return;

  global.io.to(`work-${workId}`).emit("technician_location", {
    lat,
    lng,
    status,
    eta,
    distance,
    polyline,
    updatedAt: Date.now(),
  });
};
