import type { Segment } from './types'

// Single source of truth for the three discovery segments from the
// "Boundless Customer Discovery" experiment doc (finalized July 2026).
// Used by lead generation (research qualification), outreach generation
// (positioning + template basis), and the CRM/deck UI (labels + colors).
//
// Experiment cohort targets, per segment: 15-20 researched accounts,
// >=3 substantive replies, >=2 discovery calls, >=1 qualified workload,
// >=1 accepted benchmark. Pause a segment if <2 accounts respond after
// 15-20 high-quality contacts after 5 business days.

export interface SegmentDef {
  label: string
  short: string
  chip: string
  band: string
  description: string
  positioning: string
  researchQualification: string[]
  exclude: string[]
  examples: string[]
  signals: string[]
  // Team-approved message templates. These are the BASIS for generated
  // outreach, not scripts to fill in blindly.
  templates: {
    email: string
    linkedin_connection: string
    linkedin_dm: string
    x_dm: string
  }
}

export const SEGMENTS: Record<Segment, SegmentDef> = {
  platforms: {
    label: 'Inference & Training Platforms',
    short: 'Platforms',
    chip: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    band: 'border-indigo-200',
    description: 'Startups that provide inference, model APIs, or training products and could use Boundless as an underlying capacity provider.',
    positioning: 'Boundless supplies GPU capacity to inference and training startups that already own the deployment and orchestration layer. We focus on lowering our customers’ infrastructure cost.',
    researchQualification: [
      'Provides inference, training, or model deployment as its core product',
      'Operates its own deployment or orchestration layer',
      'Shows evidence of production customers or growing demand',
    ],
    exclude: [
      'Large neoclouds such as Nebius, CoreWeave, Lambda, and Crusoe',
      'Raw GPU-as-a-service platforms competing for the same customers as Boundless',
      'Serverless GPU compute platforms (Beam, Modal, Replicate, Baseten profile) — their product IS GPU compute, so they are competitors, not buyers. A buyer’s product consumes GPU; it is not the GPU itself.',
      'Companies acquired by or absorbed into larger companies (Together AI, CoreWeave, NVIDIA, etc. have been actively acquiring this profile)',
      'Companies requiring mature global SLAs or enterprise procurement',
      'Defense, government, or geospatial-intelligence adjacent companies (security requirements the fleet cannot meet)',
      'Direct competitors with no reason to purchase outside capacity',
      'Companies with strict privacy needs, such as some medical, legal, and financial companies',
    ],
    // FinetuneDB (the doc's original example) was acquired by Opper in Sept 2025
    // and is being sunset — replaced with verified-independent profiles.
    examples: ['Featherless AI', 'Reducto', 'Refuel AI'],
    signals: [
      'Launching support for a new model or workload',
      'Introducing managed fine-tuning or hosted inference',
      'Adding dedicated deployments or new capacity',
      'Expanding into another region',
      'Changing API or usage-based pricing',
      'Announcing new production customers',
      'Hiring infrastructure, inference, training, or orchestration engineers',
    ],
    templates: {
      email: `Subject: Capacity for [specific workload or tier] at [Company]

Hi [Name],

Saw that [Company] recently [specific signal].

I'm at Boundless. We're focused on helping AI startups lower the cost of inference and training by providing GPU capacity beneath the infrastructure they already operate.

I thought [specific service or workload] might be relevant because [brief reason]. We're looking for a few teams willing to compare the economics of one real workload and, if there's a fit, benchmark it at no cost.

Is this something your team is thinking about?`,
      linkedin_connection: `Hi [Name], saw [specific signal] from [Company]. I'm at Boundless, where we're working to improve inference and training economics for teams that already operate their own infrastructure. Would be good to connect.`,
      linkedin_dm: `Thanks for connecting, [Name].

I reached out because we provide GPU capacity beneath the deployment layer teams already operate. We're looking for a few startups willing to compare their current infrastructure costs and benchmark one workload where there may be a fit.

Based on [signal], I thought [specific workload] could be relevant. Would a comparison be useful?`,
      x_dm: `Saw your post about [specific launch or infrastructure topic].

I'm at Boundless. We're focused on helping AI startups improve inference and training economics by providing capacity beneath their existing stack.

Thought [specific workload] might be relevant. Open to comparing the economics of one workload?`,
    },
  },

  media_gen: {
    label: 'Image / Video Gen Startups',
    short: 'Media Gen',
    chip: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100',
    band: 'border-fuchsia-200',
    description: 'Startups whose core product or API generates, edits, or transforms images or video using models they can deploy.',
    positioning: 'Boundless provides GPU infrastructure to image/video gen AI startups running their own models. The goal is to lower cost per image/video as volume grows while maintaining the generation time and output quality the product requires.',
    researchQualification: [
      'Image or video generation or transformation is central to the paid product',
      'Offers a developer API, batch workflows, or high-volume generation',
      'Publicly supports open, imported, custom-trained, or fine-tuned models',
      'Uses workloads such as generation, upscaling, editing, or background removal',
      'Shows signs of meaningful usage through API pricing, customer examples, or production claims',
    ],
    exclude: [
      'Primarily resells closed APIs',
      'Consumer applications with no API or visible production volume',
    ],
    examples: ['Astria', 'getimg.ai', 'Scenario', 'Recraft'],
    signals: [
      'Launching a new image or video model or feature',
      'Adding batch generation or a developer API',
      'Supporting custom, imported, or fine-tuned models',
      'Changing API pricing',
      'Introducing editing, upscaling, or transformation workflows',
      'Hiring inference or ML infrastructure engineers',
    ],
    templates: {
      email: `Subject: Cost per [image/video] for [feature]

Hi [Name],

Saw [Company] recently [specific launch or signal].

I'm at Boundless. We're focused on helping AI startups lower GPU spend as generation volume grows.

Because you're running [specific model, API, or generation workflow], I thought [workload] could be a useful one to test. We can benchmark a representative batch at no cost and share the cost per output, throughput, and generation-time results.

Worth exploring?`,
      linkedin_connection: `Hey [Name] - saw [signal]. I'm at Boundless, we run GPU infra for image/video gen teams on their own models. Think there's a fit with [workload]. Would be good to connect.`,
      linkedin_dm: `Thanks for connecting, [Name].

We're benchmarking image workloads at Boundless right now to show teams where cost per image comes down. [Signal] made me think of [workload].

Want me to run one batch and send you the numbers?`,
      x_dm: `Saw your post about [model, feature, or workflow].

I'm at Boundless. We're focused on helping image and video startups lower cost per output as usage grows.

[Specific workload] looked like a useful comparison. Would it be useful to see how the numbers compare on one of your workloads?`,
    },
  },

  agents_pt: {
    label: 'Agents & Post-training Startups',
    short: 'Agents / PT',
    chip: 'bg-teal-50 text-teal-700 border-teal-100',
    band: 'border-teal-200',
    description: 'AI-native startups improving agents for defined workflows through fine-tuning, reinforcement learning, evals, and agent harnesses.',
    positioning: 'Boundless provides GPU infrastructure for the recurring workloads behind specialized agent products, including fine-tuning, reinforcement learning, evals, rollouts, harness development, and inference.',
    researchQualification: [
      'An AI agent is the company’s core product',
      'The agent performs a defined, repeatable workflow',
      'Public evidence of fine-tuning, RL, distillation, rollouts, development of a harness, or custom models',
      'Uses smaller open or deployable models (harnesses starting to get customers are quick to move off frontier; that adoption is itself a signal)',
    ],
    exclude: [
      'Frontier closed model usage only',
      'No evidence of in-house post-training',
    ],
    examples: ['Castform', 'Cosine', 'Morph', 'Gradient Labs'],
    signals: [
      'Launching a specialized agent for a defined workflow',
      'Announcing meaningful customer adoption or usage growth',
      'Building or discussing a proprietary agent harness',
      'Adding support for a smaller or specialized model',
      'Releasing an internally trained or fine-tuned model',
      'Publishing results from reinforcement learning or post-training',
      'Discussing rollouts, synthetic data, or distillation',
      'Hiring post-training, research, or ML infrastructure engineers',
      'Publishing new agent evaluations',
      'Frequently releasing specialized model versions',
    ],
    templates: {
      email: `Subject: Economics of [fine-tuning/RL workload]

Hi [Name],

Saw [specific model, training result, or hiring signal].

I'm at Boundless. We're focused on helping AI startups lower the infrastructure cost of recurring training and inference workloads.

Your work on [agent or model] made me think your team may be running [fine-tuning, RL, distillation, or rollouts] in-house. We're looking for a few teams willing to compare the economics of one real workload and, where there's a fit, run a bounded benchmark at no cost.

Would that be relevant for [Company]?`,
      linkedin_connection: `Hi [Name], saw your work on [specific agent, model, eval, or harness]. I'm at Boundless, where we're helping AI startups improve the economics of recurring training and inference workloads. Thought what you're building looked relevant. Would be good to connect.`,
      linkedin_dm: `Thanks for connecting, [Name].

I reached out because we're helping AI startups lower the cost of recurring fine-tuning, RL, rollout, and inference workloads.

[Specific signal] made me think your team may be running [likely workload] in-house. We can evaluate a run and compare its economics with your current setup.

Would that be useful?`,
      x_dm: `Saw your post about [specific agent, model, eval, or post-training result].

I'm at Boundless. We're focused on improving the economics of recurring fine-tuning, RL, eval, rollout, and inference workloads.

Thought [specific workload] looked relevant. Open to comparing how one run performs today?`,
    },
  },
}

export const SEGMENT_KEYS = Object.keys(SEGMENTS) as Segment[]
