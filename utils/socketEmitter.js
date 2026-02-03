exports.changeStatus = (work) => {
  if (!global.io) return;

  
  global.io.to(String(work.client)).emit(
    `work_status_changed-${work._id}`,
    {
      workId: work._id,
      status: work.status,
      serviceType: work.serviceType,
      updatedAt: new Date(),
    }
  );

  
  if (work.assignedTechnician) {
    global.io.to(String(work.assignedTechnician)).emit(
      "work_status_changed",
      {
        workId: work._id,
        status: work.status,
        updatedAt: new Date(),
      }
    );
  }
};
