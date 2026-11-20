import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { PlaygroundProps } from '../components/PlaygroundFrame'

type Loader = () => Promise<{ default: ComponentType<PlaygroundProps> }>

const LOADERS: Record<string, Loader> = {
  'ping-lifecycle': () => import('./PingLifecycle'),
  'db-workbench': () => import('./DbWorkbench'),
  'ray-lab': () => import('./RayLab'),
  'angle-bench': () => import('./AngleBench'),
  'tl-fullfield': () => import('./TlFullfield'),
  'eigenray-explorer': () => import('./EigenrayExplorer'),
  'beamformer-bench': () => import('./BeamformerBench'),
  'ts-studio': () => import('./TsStudio'),
  'noise-studio': () => import('./NoiseStudio'),
  'reverb-workshop': () => import('./ReverbWorkshop'),
  'detection-bench': () => import('./DetectionBench'),
  'processor-lab': () => import('./ProcessorLab'),
  'se-console': () => import('./SeConsole'),
  'monostatic-sweep': () => import('./MonostaticSweep'),
  'bistatic-table': () => import('./BistaticTable'),
  'field-planner': () => import('./FieldPlanner'),
  'pipeline-explorer': () => import('./PipelineExplorer'),
  'display-workshop': () => import('./DisplayWorkshop'),
  'ensemble-viewer': () => import('./EnsembleViewer'),
  'scenario-room': () => import('./ScenarioRoom'),
}

export const PLAYGROUNDS: Record<string, LazyExoticComponent<ComponentType<PlaygroundProps>>> = Object.fromEntries(
  Object.entries(LOADERS).map(([id, load]) => [id, lazy(load)]),
)
