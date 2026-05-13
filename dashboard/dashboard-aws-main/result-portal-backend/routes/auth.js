const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { loginCounter, addSession } = require('../middleware/telemetry');
const { emitEvent } = require('../kafka/producer');

router.post('/login', (req, res) => {
  const { registrationNo, password } = req.body;
  console.log('[REAL LOGIN REQUEST]', req.body);

  // Mock authentication logic
  if (registrationNo && password) {
    const department = 'AIDS';
    
    loginCounter.inc({ status: 'SUCCESS' });
    addSession(registrationNo, department, req.ip);
    console.log('[6qvft9] [LOGIN TELEMETRY GENERATED]');

    const loginPayload = {
      timestamp: Date.now(),
      registrationNo,
      department,
      status: 'SUCCESS',
      ip: req.ip
    };

    emitEvent('login-events', loginPayload);
    console.log('[6qvft9] [KAFKA LOGIN EVENT SENT]');
    console.log('[6qvft9] [LOGIN SUCCESS]', registrationNo);

    const token = jwt.sign({ registrationNo, department }, 'secret', { expiresIn: '30m' });

    res.json({ token, message: 'Login successful' });
  } else {
    loginCounter.inc({ status: 'FAILURE' });
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

module.exports = router;
