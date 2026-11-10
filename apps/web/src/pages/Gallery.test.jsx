import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, test } from 'vitest';
import { makeStore } from '../store/index.js';
import { Gallery } from './Gallery.jsx';

const setup = () => {
  const store = makeStore();
  render(
    <Provider store={store}>
      <Gallery />
    </Provider>,
  );
  return store;
};

describe('Gallery', () => {
  test('shows the school, the role menu and invoice statuses from the shared rules', () => {
    setup();
    expect(screen.getByText('Unity Heritage College')).toBeTruthy();
    expect(screen.getByText('Powered by ClassBridge')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'head menu' })).toBeTruthy();
    expect(screen.getByText('Paid in full')).toBeTruthy();
    expect(screen.getByText('Part paid')).toBeTruthy();
    expect(screen.getByText('Unpaid')).toBeTruthy();
  });

  test('choosing a school colour updates the store and the page colour', () => {
    const store = setup();
    fireEvent.click(screen.getByRole('button', { name: /Maroon/ }));
    expect(store.getState().ui.accent).toBe('#8a1c3c');
    expect(document.documentElement.style.getPropertyValue('--school-accent')).toBe('#8a1c3c');
  });

  test('menu marks the current page', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Receipts' }));
    expect(screen.getByRole('button', { name: 'Receipts' }).getAttribute('aria-current')).toBe('page');
  });
});
