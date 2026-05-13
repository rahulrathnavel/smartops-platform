'use strict';

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-grpc');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { Resource } = require('@opentelemetry/resources');
const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = require('@opentelemetry/semantic-conventions');

const SERVICE_NAME = process.env.SERVICE_NAME || 'catalog-service';
const OTEL_COLLECTOR_URL = process.env.OTEL_COLLECTOR_URL || 'http://otel-collector:4317';

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: SERVICE_NAME,
    [ATTR_SERVICE_VERSION]: '1.0.0',
    'deployment.environment': process.env.NODE_ENV || 'production',
  }),
  traceExporter: new OTLPTraceExporter({ url: OTEL_COLLECTOR_URL }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({ url: OTEL_COLLECTOR_URL }),
    exportIntervalMillis: 30000,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

sdk.start();
console.log(JSON.stringify({ level: 'info', service: SERVICE_NAME, msg: 'OpenTelemetry tracing initialized' }));

process.on('SIGTERM', () => {
  sdk.shutdown().then(() => console.log(JSON.stringify({ level: 'info', service: SERVICE_NAME, msg: 'OTel SDK shut down' })));
});

module.exports = sdk;
