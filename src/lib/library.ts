// The documentation library used by the demo.
// Each page has an "original" version (before Google Cloud Next) and an "updated"
// version (after). Text is paraphrased from real Google Cloud pages and the changes
// mirror real announcements, but these are simulated snapshots, not copies.

export type DocKind = "exam_guide" | "docs";

export interface LibraryDoc {
  id: string;
  kind: DocKind;
  url: string;
  original: { title: string; text: string } | null; // null = page did not exist yet
  updated: { title: string; text: string } | null; // null = page removed
}

export const LIBRARY: LibraryDoc[] = [
  {
    id: "exam-guide",
    kind: "exam_guide",
    url: "https://cloud.google.com/learn/certification/guides/professional-cloud-architect",
    original: {
      title: "Professional Cloud Architect exam guide",
      text: `## Section 1: Designing and planning a cloud solution architecture (about 24% of the exam)
Covers designing for business and technical requirements: cost optimization, high availability, scalability and performance. Candidates choose compute resources such as Compute Engine, Google Kubernetes Engine (GKE), Cloud Run and Cloud Functions, and appropriate storage, database and network services.

## Section 2: Managing and provisioning a solution infrastructure (about 15% of the exam)
Covers configuring network topologies, storage systems and compute systems, and provisioning infrastructure as code with Deployment Manager templates and Terraform.

## Section 3: Designing for security and compliance (about 18% of the exam)
Covers Identity and Access Management (IAM) and the principle of least privilege, the resource hierarchy, VPC Service Controls, encryption keys with Cloud KMS, and meeting compliance requirements.

## Section 4: Analyzing and optimizing technical and business processes (about 18% of the exam)
Covers CI/CD with Cloud Build and Container Registry, cost optimization including BigQuery flat-rate commitments, data processing with Pub/Sub, and disaster recovery planning.

## Section 5: Managing implementation (about 11% of the exam)
Covers advising development and operations teams and interacting with Google Cloud through Cloud Shell, the Cloud SDK and local emulators.

## Section 6: Ensuring solution and operations reliability (about 14% of the exam)
Covers monitoring, logging and alerting with Google Cloud Observability, release management, and database high availability such as Cloud SQL.`,
    },
    updated: {
      title: "Professional Cloud Architect exam guide",
      text: `## Section 1: Designing and planning a cloud solution architecture (about 25% of the exam)
Covers designing for business and technical requirements: cost optimization, high availability, scalability and performance. Candidates choose compute resources such as Compute Engine, Google Kubernetes Engine (GKE) and Cloud Run (including Cloud Run functions), and appropriate storage, database and network services. Also covers designing solutions that use generative AI with Vertex AI and Gemini models.

## Section 2: Managing and provisioning a solution infrastructure (about 17% of the exam)
Covers configuring network topologies, storage systems and compute systems, and provisioning infrastructure as code with Terraform and Infrastructure Manager.

## Section 3: Designing for security and compliance (about 18% of the exam)
Covers Identity and Access Management (IAM) and the principle of least privilege, the resource hierarchy, VPC Service Controls, encryption keys with Cloud KMS, and meeting compliance requirements.

## Section 4: Analyzing and optimizing technical and business processes (about 15% of the exam)
Covers CI/CD with Cloud Build and Artifact Registry, cost optimization including BigQuery editions and slot commitments, data processing with Pub/Sub, and disaster recovery planning.

## Section 5: Managing implementation (about 12% of the exam)
Covers advising development and operations teams, interacting with Google Cloud through Cloud Shell, the Cloud SDK and local emulators, and using Gemini Cloud Assist to design, operate and troubleshoot applications.

## Section 6: Ensuring solution and operations reliability (about 13% of the exam)
Covers monitoring, logging and alerting with Google Cloud Observability, release management, and database high availability such as Cloud SQL.`,
    },
  },
  {
    id: "container-registry",
    kind: "docs",
    url: "https://cloud.google.com/container-registry/docs/overview",
    original: {
      title: "Container Registry",
      text: `## Overview
Container Registry is Google Cloud's private registry for Docker container images. It stores images in Cloud Storage buckets in your project, controls access with IAM, and Google Kubernetes Engine (GKE) clusters can pull images from it directly.

## Using with Cloud Build
Cloud Build can push the images it builds to Container Registry, so a CI/CD pipeline can build an image and then deploy it to GKE.`,
    },
    updated: {
      title: "Container Registry",
      text: `## Overview
Container Registry is deprecated and no longer accepts new images. Use Artifact Registry instead. Artifact Registry is the recommended private registry for container images and language packages: it uses regional or multi-regional repositories, controls access with IAM on each repository, and Google Kubernetes Engine (GKE) clusters can pull images from it directly.

## Using with Cloud Build
Cloud Build pushes the images it builds to Artifact Registry, so a CI/CD pipeline can build an image and then deploy it to GKE.

## Migrating
Existing Container Registry users should migrate to Artifact Registry. Images under gcr.io domains can be served from Artifact Registry repositories.`,
    },
  },
  {
    id: "cloud-functions",
    kind: "docs",
    url: "https://cloud.google.com/functions/docs/concepts/overview",
    original: {
      title: "Cloud Functions",
      text: `## Overview
Cloud Functions is a serverless, event-driven compute service. You write a single-purpose function and attach it to a trigger, and you pay only while the function runs.

## Event triggers
A function can run automatically when an object is finalized (uploaded) in a Cloud Storage bucket, when a message is published to a Pub/Sub topic, or when it receives an HTTP request.

## Concurrency
Second-generation functions can handle up to 1,000 concurrent requests per instance, which reduces cold starts under bursty traffic.`,
    },
    updated: {
      title: "Cloud Run functions",
      text: `## Overview
Cloud Functions is now Cloud Run functions. Functions are deployed as Cloud Run services and keep the same model: you write a single-purpose function, attach it to a trigger, and pay only while it runs.

## Event triggers
A Cloud Run function can run automatically when an object is finalized (uploaded) in a Cloud Storage bucket, when a message is published to a Pub/Sub topic, or when it receives an HTTP request. Event triggers are delivered through Eventarc.

## Concurrency
A Cloud Run function can handle up to 1,000 concurrent requests per instance, which reduces cold starts under bursty traffic.`,
    },
  },
  {
    id: "deployment-manager",
    kind: "docs",
    url: "https://cloud.google.com/deployment-manager/docs",
    original: {
      title: "Deployment Manager",
      text: `## Overview
Deployment Manager is Google Cloud's infrastructure deployment service. You describe resources in YAML configuration files, optionally using Jinja2 or Python templates, and Deployment Manager creates them together as a single deployment.

## Previewing changes
Running an update with the --preview flag shows the changes Deployment Manager would make without creating or modifying any resources. The deployment stays in preview until you commit or cancel the update.`,
    },
    updated: {
      title: "Deployment Manager",
      text: `## Overview
Deployment Manager is deprecated and reaches end of support on March 31, 2026. Migrate your deployments to Infrastructure Manager, which provisions Google Cloud resources from Terraform configurations.

## Infrastructure Manager
Infrastructure Manager runs Terraform for you: you keep a Terraform configuration in a Git repository or Cloud Storage, and Infrastructure Manager plans and applies it and manages the Terraform state. You can create a preview to see planned changes before applying them.`,
    },
  },
  {
    id: "cloud-storage",
    kind: "docs",
    url: "https://cloud.google.com/storage/docs/storage-classes",
    original: {
      title: "Cloud Storage",
      text: `## Storage classes
Standard storage suits frequently accessed data. Nearline has a 30-day minimum storage duration, Coldline 90 days and Archive 365 days. Archive has the lowest storage cost and the highest retrieval cost, and all classes offer millisecond access to data.

## Object Lifecycle Management
Lifecycle rules can change an object's storage class or delete it when conditions such as its age are met, for example moving objects to Coldline after 90 days.

## Deleting objects
Deleting an object removes it permanently. To be able to recover deleted or overwritten objects, enable Object Versioning on the bucket before the deletion happens.`,
    },
    updated: {
      title: "Cloud Storage",
      text: `## Data lifecycle: choosing a storage class
Standard storage suits frequently accessed data. Nearline has a 30-day minimum storage duration, Coldline 90 days and Archive 365 days. Archive has the lowest storage cost and the highest retrieval cost, and all classes offer millisecond access to data.

## Data lifecycle: Object Lifecycle Management
Lifecycle rules can change an object's storage class or delete it when conditions such as its age are met, for example moving objects to Coldline after 90 days.

## Autoclass
Autoclass automatically moves each object to a colder or warmer storage class based on how often it is accessed, without any lifecycle rules.

## Data protection: soft delete
Soft delete is now on by default for every bucket: deleted and overwritten objects are kept for 7 days and can be restored during that time. The retention period can be set between 7 and 90 days, or soft delete can be turned off. Object Versioning is still available for keeping older versions for longer.`,
    },
  },
  {
    id: "pubsub",
    kind: "docs",
    url: "https://cloud.google.com/pubsub/docs/subscriber",
    original: {
      title: "Pub/Sub",
      text: `## Delivery
Pub/Sub delivers each message at least once by default. Subscribers must acknowledge each message; messages that are not acknowledged before the acknowledgement deadline are redelivered. Exactly-once delivery can be enabled on pull subscriptions.`,
    },
    updated: {
      title: "Pub/Sub",
      text: `## Delivery
By default, Pub/Sub delivers every message at least once. A subscriber acknowledges each message it processes, and any message that is not acknowledged before its acknowledgement deadline is delivered again. Pull subscriptions can turn on exactly-once delivery.`,
    },
  },
  {
    id: "cloud-sql",
    kind: "docs",
    url: "https://cloud.google.com/sql/docs/mysql/high-availability",
    original: {
      title: "Cloud SQL",
      text: `## High availability
A Cloud SQL high-availability instance has a primary instance in one zone and a standby instance in another zone of the same region. Writes are synchronously replicated to the standby, and if the primary's zone fails, Cloud SQL fails over to the standby automatically.

## Read replicas
Read replicas offload read traffic from the primary. They use asynchronous replication and do not provide automatic failover.`,
    },
    updated: {
      title: "Cloud SQL",
      text: `## High availability
A Cloud SQL high-availability instance has a primary instance in one zone and a standby instance in another zone of the same region. Writes are synchronously replicated to the standby, and if the primary's zone fails, Cloud SQL fails over to the standby automatically.

## Read replicas
Read replicas offload read traffic from the primary. They use asynchronous replication and do not provide automatic failover.`,
    },
  },
  {
    id: "bigquery-pricing",
    kind: "docs",
    url: "https://cloud.google.com/bigquery/pricing",
    original: {
      title: "BigQuery pricing",
      text: `## Compute pricing
On-demand pricing charges for the number of bytes each query processes. With flat-rate pricing you instead buy a fixed number of slots on a monthly or annual commitment, which gives a predictable cost regardless of the bytes processed.`,
    },
    updated: {
      title: "BigQuery pricing",
      text: `## Compute pricing
On-demand pricing charges for the number of bytes each query processes. Flat-rate pricing has been retired and replaced by BigQuery editions (Standard, Enterprise and Enterprise Plus). With editions you reserve slots, can turn on autoscaling, and can buy one- or three-year commitments for a predictable cost.`,
    },
  },
  {
    id: "gemini-cloud-assist",
    kind: "docs",
    url: "https://cloud.google.com/gemini/docs/cloud-assist/overview",
    original: null,
    updated: {
      title: "Gemini Cloud Assist",
      text: `## Overview
Gemini Cloud Assist is now generally available. It is an AI assistant in the Google Cloud console that helps you design, deploy, operate and troubleshoot applications.

## Investigations
Gemini Cloud Assist investigations analyze logs, metrics and configuration to suggest the likely root cause of an incident and the steps to fix it.`,
    },
  },
];

/** Every page that exists before the update (the full scenario). */
export const ALL_ORIGINAL = LIBRARY.filter((d) => d.original).map((d) => d.id);
/** What the demo starts with: just Cloud Storage, a small, fast run. */
export const DEFAULT_SELECTION = ["cloud-storage"];
