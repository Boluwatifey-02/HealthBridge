const PERMISSIONS = {
  Receptionist: [
    'registerPatient',
    'viewPatient',
    'searchPatient',
    'scheduleAppointment',
    'viewAppointments',
    'viewDashboard',
  ],
  Doctor: [
    'viewPatient',
    'searchPatient',
    'viewMedicalHistory',
    'createConsultation',
    'writePrescription',
    'requestLabTest',
    'viewLabResults',
    'viewAppointments',
    'viewDashboard',
  ],
  Pharmacist: [
    'viewPrescriptions',
    'dispenseDrug',
    'manageInventory',
    'viewDashboard',
  ],
  'Laboratory Staff': [
    'viewLabRequests',
    'uploadLabResult',
    'viewDashboard',
  ],
  Administrator: [
    'manageStaff',
    'viewAnalytics',
    'viewAuditLog',
    'manageInventory',
    'viewPatient',
    'searchPatient',
    'viewAppointments',
    'viewPrescriptions',
    'viewLabRequests',
    'viewDashboard',
  ],
  Admin: [
    'manageStaff',
    'viewAnalytics',
    'viewAuditLog',
    'manageInventory',
    'viewPatient',
    'searchPatient',
    'viewAppointments',
    'viewPrescriptions',
    'viewLabRequests',
    'viewDashboard',
  ],
};

function authorize(action) {
  return function (req, res, next) {
    const role = req.user && req.user.role;
    const allowed = PERMISSIONS[role] || [];

    if (!allowed.includes(action)) {
      return res.status(403).json({
        message: `Access denied: '${action}' is not permitted for role '${role || 'unknown'}'.`,
      });
    }

    return next();
  };
}

module.exports = { authorize, PERMISSIONS };
