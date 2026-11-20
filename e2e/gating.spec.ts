import { expect, test, type Page } from '@playwright/test'
import { resolve } from 'node:path'
import { UNIT_META } from '../src/curriculum/meta'
import { buildTest } from '../src/curriculum/questions/engine'
import { BANKS } from '../src/curriculum/questions/index'

const SITE = `file://${resolve('dist/index.html')}`
const STORAGE_KEY = 'active-acoustics-academy-v1'

async function open(page: Page, route: string): Promise<void> {
  await page.goto('about:blank')
  await page.goto(`${SITE}#${route}`)
}

async function answer(page: Page, unitId: string, seed: number, correctly: boolean): Promise<void> {
  const questions = buildTest(BANKS[unitId], seed)
  const cards = page.getByTestId('question')
  await expect(cards).toHaveCount(questions.length)
  for (const [i, q] of questions.entries()) {
    const card = cards.nth(i)
    await expect(card).toHaveAttribute('data-qid', q.id)
    if (q.kind === 'numeric') {
      await card.locator('input[type="text"]').fill(String(correctly ? q.answer : q.answer + q.tolerance * 5 + 3))
    } else {
      const pick = correctly ? q.correct : (q.correct + 1) % q.options.length
      await card.locator('.q-option').nth(pick).click()
    }
  }
  await page.getByTestId('submit-test').click()
}

test('a unit stays locked until the test before it is passed', async ({ page }) => {
  await open(page, '/unit/u02')
  await expect(page.getByTestId('locked')).toBeVisible()
  await expect(page.getByTestId('locked')).toContainText('Unit 2 is locked')

  // A failed attempt records the try and opens nothing.
  await open(page, '/unit/u01/test?seed=4242')
  await answer(page, 'u01', 4242, false)
  await expect(page.getByTestId('result')).toHaveAttribute('data-passed', 'false')
  await open(page, '/unit/u02')
  await expect(page.getByTestId('locked')).toBeVisible()

  // A passing attempt opens the next unit and nothing beyond it.
  await open(page, '/unit/u01/test?seed=9001')
  await answer(page, 'u01', 9001, true)
  await expect(page.getByTestId('result')).toHaveAttribute('data-passed', 'true')
  await expect(page.getByTestId('result')).toContainText('10 of 10 correct')
  await open(page, '/unit/u02')
  await expect(page.getByTestId('locked')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Decibels')
  await open(page, '/unit/u03')
  await expect(page.getByTestId('locked')).toBeVisible()

  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), STORAGE_KEY)
  expect(saved.state.units.u01.passed).toBe(true)
  expect(saved.state.units.u01.attempts).toBe(2)
})

test('reading a leaf to the end marks it read', async ({ page }) => {
  await open(page, '/unit/u01')
  await page.getByRole('link', { name: /Start reading/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('What active sonar does')
  await page.keyboard.press('End')
  await expect
    .poll(async () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}')?.state?.units?.u01?.leaves?.length ?? 0, STORAGE_KEY))
    .toBeGreaterThan(0)
})

test('every unit, playground and reference page renders without errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.addInitScript(
    ([key, ids]) => {
      // The helper passes through about:blank, which has no storage.
      if (location.protocol !== 'file:') return
      const units = Object.fromEntries((ids as string[]).map((id) => [id, { leaves: [], best: 1, passed: true, attempts: 1 }]))
      localStorage.setItem(key as string, JSON.stringify({ state: { units }, version: 1 }))
    },
    [STORAGE_KEY, UNIT_META.map((u) => u.id)],
  )
  for (const unit of UNIT_META) {
    await open(page, `/unit/${unit.id}`)
    await expect(page.locator('.leaf-card').first()).toBeVisible()
    await open(page, `/unit/${unit.id}/playground`)
    await expect(page.locator('.pg-title')).toBeVisible()
    await expect(page.locator('.pg canvas, .pg svg').first()).toBeVisible()
  }
  await open(page, '/glossary')
  await expect(page.locator('.gloss-item').first()).toBeVisible()
  await open(page, '/sources')
  await expect(page.locator('.ref').first()).toBeVisible()
  await open(page, '/')
  await expect(page.locator('.tree-unit')).toHaveCount(UNIT_META.length)
  expect(errors).toEqual([])
})
