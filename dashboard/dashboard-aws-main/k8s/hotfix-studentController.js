const jwt = require("jsonwebtoken");
const { GetCommand } = require("@aws-sdk/lib-dynamodb");
const dynamoClient = require("../config/dynamoClient");
const { loginRequests, failedLogins } = require("../metrics/metrics");
const { send } = require("../utils/producer");
const activeSessions = require("../utils/sessions");

const TABLE_NAME = process.env.DYNAMODB_TABLE || "students-results";

const loginStudent = async (req, res) => {
  const { registration_no, password } = req.body;
  const start = Date.now();
  console.log('[REAL LOGIN REQUEST]', req.body);

  try {
    const result = await dynamoClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { registration_no } }));
    const student = result.Item;

    if (!student || student.password !== password) {
      failedLogins.inc({ status: "failed" });
      console.log('[PROM COUNTER UPDATED] failed_logins_total {status: failed}');
      console.log("[6qvft9] [LOGIN FAILURE]", registration_no);
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    // Success
    loginRequests.inc({ status: "success" });
    console.log('[PROM COUNTER UPDATED] login_requests_total {status: success}');
    activeSessions.set(registration_no, { loginTime: Date.now(), lastActivity: Date.now() });
    console.log("[6qvft9] [LOGIN SUCCESS]", registration_no);
    console.log("[6qvft9] [LOGIN TELEMETRY GENERATED]");
    console.log("[0u9vlj] [SESSION TRACKED]", registration_no);

    const token = jwt.sign({ registration_no: student.registration_no, name: student.name }, process.env.JWT_SECRET || "secret", { expiresIn: "24h" });

    // Kafka Event
    await send("login-events", { regno: registration_no, timestamp: Date.now(), status: "SUCCESS" });
    console.log('[KAFKA LOGIN EVENT SENT]');

    res.json({ 
      success: true, 
      token, 
      message: 'Login successful',
      registrationNo: student.registration_no,
      profile: { 
        registration_no: student.registration_no, 
        registrationNo: student.registration_no,
        name: student.name 
      },
      user: { 
        registration_no: student.registration_no, 
        registrationNo: student.registration_no,
        name: student.name 
      } 
    });
  } catch (err) {
    console.error("[6qvft9] [SERVER ERROR]", err.message);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

const getStudent = async (req, res) => {
  res.json({ success: true });
};

const getResults = async (req, res) => {
  res.json({ success: true, results: [] });
};

module.exports = { loginStudent, getStudent, getResults };
