const { ApiError } = require('../lib/http');

/**
 * Role-based access control.
 *
 * These permissions were defined from the start but nothing consulted them, so
 * every signed-in account could read every patient's record and every route
 * accepted writes from any role. Each permission below is now enforced by at
 * least one route, and the matrix follows how the roles actually work day to
 * day: reception books and registers, doctors treat, the pharmacy dispenses
 * what a doctor prescribed, the laboratory reports results, and an
 * administrator oversees the whole system.
 */

// A patient's own record, and nothing else.
const PATIENT_SELF = ['viewOwnRecord'];

const PERMISSIONS = {
  Receptionist: [
    'registerPatient',
    'viewPatient',
    'searchPatient',
    'editPatientDemographics',
    'scheduleAppointment',
    'viewAppointments',
    'updateAppointment',
    'cancelAppointment',
    'viewDashboard',
    'viewActivity',
  ],
  Doctor: [
    'viewPatient',
    'searchPatient',
    'viewMedicalHistory',
    'editPatientDemographics',
    'createConsultation',
    'viewConsultations',
    'writePrescription',
    'viewPrescriptions',
    'requestLabTest',
    'viewLabRequests',
    'viewLabResults',
    'updateAppointment',
    'viewAppointments',
    'viewDashboard',
    'viewActivity',
    'viewAnalytics',
  ],
  Pharmacist: [
    'viewPrescriptions',
    'dispenseDrug',
    'cancelPrescription',
    'manageInventory',
    'viewInventory',
    'viewPatient',
    'viewDashboard',
    'viewActivity',
  ],
  'Laboratory Staff': [
    'viewLabRequests',
    'uploadLabResult',
    'viewLabResults',
    'viewPatient',
    'viewDashboard',
    'viewActivity',
  ],
  Administrator: [
    'manageStaff',
    'viewStaff',
    'viewAnalytics',
    'viewAuditLog',
    'manageInventory',
    'viewInventory',
    'viewPatient',
    'searchPatient',
    'viewMedicalHistory',
    'editPatientDemographics',
    'viewAppointments',
    'scheduleAppointment',
    'updateAppointment',
    'cancelAppointment',
    'viewConsultations',
    'createConsultation',
    'viewPrescriptions',
    'writePrescription',
    'dispenseDrug',
    'cancelPrescription',
    'viewLabRequests',
    'viewLabResults',
    'requestLabTest',
    'uploadLabResult',
    'registerPatient',
    'viewDashboard',
    'viewActivity',
    'viewInsights',
  ],
  // A patient may only reach their own record.
  Patient: PATIENT_SELF,
};

const ALL_PERMISSIONS = [
  ...new Set(Object.values(PERMISSIONS).flat()),
];

function permissionsFor(role) {
  return PERMISSIONS[role] || [];
}

function can(role, action) {
  return permissionsFor(role).includes(action);
}

/**
 * Guards a route on a permission. Uses the role from the database-backed
 * request user rather than anything the client supplied.
 */
function authorize(action) {
  return function guard(req, res, next) {
    const user = req.user;

    if (!user) {
      return next(ApiError.unauthorized('Authentication required.'));
    }

    if (user.audience === 'patient' && !PATIENT_SELF.includes(action)) {
      return next(ApiError.forbidden('This area is for HealthBridge staff only.'));
    }

    if (!can(user.role, action)) {
      return next(
        ApiError.forbidden(
          `Your role (${user.role || 'unknown'}) is not permitted to perform this action.`
        )
      );
    }

    return next();
  };
}

/**
 * Patient portal tokens carry a patientId. This resolves the patient the token
 * belongs to, so a patient can never read another patient's record by changing
 * an id in the request.
 */
function requirePatientScope(req, res, next) {
  if (req.user && req.user.audience === 'patient') {
    req.patientScope = req.user.id;
  }

  return next();
}

module.exports = { authorize, permissionsFor, can, requirePatientScope, PERMISSIONS, ALL_PERMISSIONS };
