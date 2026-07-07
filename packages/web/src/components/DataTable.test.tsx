import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { DataTable, type DataTableColumn } from './DataTable.js';

interface Row {
  id: string;
  name: string;
}

const columns: DataTableColumn<Row>[] = [
  { key: 'name', header: 'Name', render: (row) => row.name },
];

const rows: Row[] = [
  { id: '1', name: 'Alex' },
  { id: '2', name: 'Sam' },
];

describe('DataTable', () => {
  it('renders a row per item with the caption and column header', () => {
    render(
      <DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} caption="Test table" />,
    );
    expect(screen.getByText('Test table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByText('Alex')).toBeInTheDocument();
    expect(screen.getByText('Sam')).toBeInTheDocument();
  });

  it('shows the loading skeleton instead of rows when loading and no data yet', () => {
    render(
      <DataTable columns={columns} rows={[]} getRowKey={(r) => r.id} loading loadingRows={3} />,
    );
    expect(screen.getAllByTestId('skeleton-row')).toHaveLength(3);
    expect(screen.queryByText('Alex')).not.toBeInTheDocument();
  });

  it('prefers the error+retry state over loading/empty when both an error and onRetry are given', () => {
    const onRetry = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={[]}
        getRowKey={(r) => r.id}
        loading
        error="Could not reach the server"
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Could not reach the server')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state when not loading, no error, and rows is empty', () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        getRowKey={(r) => r.id}
        empty={{ title: 'No visits yet', body: 'Schedule one to get started.' }}
      />,
    );
    expect(screen.getByText('No visits yet')).toBeInTheDocument();
    expect(screen.getByText('Schedule one to get started.')).toBeInTheDocument();
  });
});
