// Role-Based Access Control matrix — this is the exact same matrix
// presented as Table 3.10 in Chapter 3, Section 3.7.1 of the project
// documentation. Each key is an action a route can require via authorize().
const PERMISSIONS = {
  Receptionist: [
    "registerPatient", "viewPatient", "searchPatient",
    "scheduleAppointment", "viewAppointments",
  ],
  Doctor: [
    "viewPatient", "searchPatient", "viewMedicalHistory",
    "createConsultation", "writePrescription", "requestLabTest", "viewLabResults",
    "viewAppointments",
  ],
  Pharmacist: [
    "viewPrescriptions", "dispenseDrug", "manageInventory",
  ],
  "Lab Staff": [
    "viewLabRequests", "uploadLabResult",
  ],
  Admin: [
    "manageStaff", "viewAnalytics", "backupDatabase", "viewAuditLog",
    "viewPatient", "searchPatient", "viewAppointments", "viewPrescriptions",
    "manageInventory", "viewLabRequests",
  ],
};

// Usage: router.post('/patients', authenticate, authorize('registerPatient'), handler)
function authorize(action) {
  return function (req, res, next) {
    const role = req.user && req.user.role;
    const allowed = PERMISSIONS[role] || [];
    if (!allowed.includes(action)) {
      return res.status(403).json({
        error: `Access denied: '${action}' is not permitted for role '${role}'.`,
      });
    }
    next();
  };
}

module.exports = { authorize, PERMISSIONS };
