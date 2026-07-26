import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AssistantPreview } from './AssistantPreview';

describe('AssistantPreview', () => {
  it('is enabled and responds to concierge-style questions', async () => {
    const user = userEvent.setup();
    render(<AssistantPreview />);
    expect(screen.getByLabelText(/Assistant preview/i)).toBeInTheDocument();
    expect(screen.getByText(/^Available now$/i)).toBeInTheDocument();
    const ask = screen.getByRole('button', { name: /^Ask$/i });
    expect(ask).toBeEnabled();
    await user.clear(screen.getByLabelText(/Ask the assistant/i));
    await user.type(screen.getByLabelText(/Ask the assistant/i), 'Help me plan flights and hotels');
    await user.click(ask);
    expect(screen.getByText(/Open Flights and Hotels/i)).toBeInTheDocument();
    expect(screen.queryByText(/disabled/i)).not.toBeInTheDocument();
  });
});
