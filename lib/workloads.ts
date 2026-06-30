import type { UseCase } from './types'

// Single source of truth for the inference-cloud workload taxonomy.
// `label` is what the user sees; `chip` is the pill style on cards/CRM;
// `bar` is the solid fill used on the patterns page. `pain` is the
// throughput/cost friction that workload tends to feel — used to ground
// discovery outreach.
export const WORKLOADS: Record<
  UseCase,
  { label: string; chip: string; bar: string; pain: string }
> = {
  evals: {
    label: 'Evals',
    chip: 'bg-blue-50 text-blue-700 border-blue-100',
    bar: 'bg-blue-500',
    pain: 'every model bump re-runs the whole eval suite, and CI-gated eval runs queue up and block releases',
  },
  synth_data: {
    label: 'Synthetic Data',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    bar: 'bg-emerald-500',
    pain: 'generating millions of samples is GPU-bound and the bill scales linearly with dataset size',
  },
  agents: {
    label: 'Agent Runs',
    chip: 'bg-violet-50 text-violet-700 border-violet-100',
    bar: 'bg-violet-500',
    pain: 'long multi-step agent loops burn tokens, and running many in parallel hits rate limits and cost ceilings',
  },
  docs: {
    label: 'Doc Processing',
    chip: 'bg-amber-50 text-amber-700 border-amber-100',
    bar: 'bg-amber-500',
    pain: 'page-volume backfills and reprocessing are throughput-bound, and cost scales with every page',
  },
  media: {
    label: 'Image / Video',
    chip: 'bg-rose-50 text-rose-700 border-rose-100',
    bar: 'bg-rose-500',
    pain: 'batch rendering is GPU-heavy and catalog-scale generation is cost-bound, not latency-bound',
  },
  batch: {
    label: 'Batch Inference',
    chip: 'bg-sky-50 text-sky-700 border-sky-100',
    bar: 'bg-sky-500',
    pain: 'high-volume offline inference where $/token dominates and waiting in a queue is acceptable',
  },
}

export const WORKLOAD_KEYS = Object.keys(WORKLOADS) as UseCase[]
