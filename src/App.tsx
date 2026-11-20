import type { ReactElement } from 'react'
import { RouterProvider, createHashRouter } from 'react-router'
import { Shell } from './components/Shell'
import { Glossary } from './pages/Glossary'
import { Home } from './pages/Home'
import { LeafPage } from './pages/LeafPage'
import { Sources } from './pages/Sources'
import { UnitPage } from './pages/UnitPage'

// Hash routing keeps every link working when the built file is opened straight from disk.
const router = createHashRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <Home /> },
      { path: 'unit/:unitId/leaf/:leafId', element: <LeafPage /> },
      { path: 'unit/:unitId/:tab?', element: <UnitPage /> },
      { path: 'glossary', element: <Glossary /> },
      { path: 'sources', element: <Sources /> },
      { path: '*', element: <Home /> },
    ],
  },
])

export function App(): ReactElement {
  return <RouterProvider router={router} />
}
