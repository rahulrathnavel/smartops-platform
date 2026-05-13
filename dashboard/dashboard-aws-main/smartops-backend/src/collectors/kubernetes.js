const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
const k8sAutoscalingApi = kc.makeApiClient(k8s.AutoscalingV2Api);

async function getClusterState() {
  try {
    const [podsRes, nodesRes, deploymentsRes, servicesRes, eventsRes, hpaRes] = await Promise.all([
      k8sApi.listPodForAllNamespaces(),
      k8sApi.listNode(),
      k8sAppsApi.listDeploymentForAllNamespaces(),
      k8sApi.listServiceForAllNamespaces(),
      k8sApi.listEventForAllNamespaces(),
      k8sAutoscalingApi.listHorizontalPodAutoscalerForAllNamespaces()
    ]);

    const pods = podsRes.body.items.map(pod => ({
      name: pod.metadata.name,
      namespace: pod.metadata.namespace,
      status: pod.status.phase,
      restarts: pod.status.containerStatuses ? pod.status.containerStatuses.reduce((acc, curr) => acc + curr.restartCount, 0) : 0,
      node: pod.spec.nodeName
    }));

    const nodes = nodesRes.body.items.map(node => ({
      name: node.metadata.name,
      status: node.status.conditions.find(c => c.type === 'Ready')?.status === 'True' ? 'Ready' : 'NotReady',
      readyCondition: node.status.conditions.find(c => c.type === 'Ready')
    }));

    const deployments = deploymentsRes.body.items.map(deploy => ({
      name: deploy.metadata.name,
      namespace: deploy.metadata.namespace,
      replicas: deploy.spec.replicas,
      readyReplicas: deploy.status.readyReplicas || 0
    }));

    const services = servicesRes.body.items.map(svc => ({
      name: svc.metadata.name,
      namespace: svc.metadata.namespace,
      type: svc.spec.type,
      clusterIP: svc.spec.clusterIP
    }));

    const events = eventsRes.body.items.slice(-20).map(event => ({
      reason: event.reason,
      message: event.message,
      namespace: event.metadata.namespace,
      involvedObject: event.involvedObject.name,
      timestamp: event.lastTimestamp || event.eventTime
    }));

    const hpas = hpaRes.body.items.map(hpa => ({
      name: hpa.metadata.name,
      namespace: hpa.metadata.namespace,
      currentReplicas: hpa.status.currentReplicas || 0,
      desiredReplicas: hpa.status.desiredReplicas || 0,
      minReplicas: hpa.spec.minReplicas || 1,
      maxReplicas: hpa.spec.maxReplicas || 1,
      currentCPUPercent: hpa.status.currentMetrics?.find(m => m.type === 'Resource' && m.resource.name === 'cpu')?.resource.current.averageUtilization || 0,
      targetCPUPercent: hpa.spec.metrics?.find(m => m.type === 'Resource' && m.resource.name === 'cpu')?.resource.target.averageUtilization || 0
    }));

    return {
      pods,
      nodes,
      deployments,
      services,
      events,
      hpas
    };
  } catch (error) {
    console.error('[K8S API ERROR]', error.message);
    throw error;
  }
}

module.exports = {
  getClusterState
};
