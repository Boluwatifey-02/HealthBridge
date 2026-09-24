const express = require('express');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { getStore } = require('../config/db');

const router = express.Router();

router.use(authenticate);

router.get('/doctors', authorize('viewAppointments'), (req, res) => {
  const store = getStore();
  const doctors = store.staff.filter((member) => ['Doctor', 'Administrator'].includes(member.role));

  res.json(doctors.map((member) => ({
    id: member.id,
    name: member.fullName,
    role: member.role,
    branch: member.branch,
  })));
});

module.exports = router;
