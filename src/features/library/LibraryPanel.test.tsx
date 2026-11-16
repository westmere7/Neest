import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '@/packs/loader';
import { createEmptyProject } from '@/domain/model/defaults';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';
import { LibraryPanel } from './LibraryPanel';

describe('LibraryPanel furniture left category sidebar', { timeout: 20_000 }, () => {
  beforeEach(() => {
    Element.prototype.scrollTo = () => {};
    useProjectStore.getState().load(createEmptyProject());
    useEditorStore.setState({ libraryOpen: true, libraryTab: 'furniture', workspace: 'plan' });
  });

  it('renders the left category rail with By room above By item', () => {
    render(<LibraryPanel isMobile={false} />);
    const rail = screen.getByTestId('library-categories');
    const roomsGroup = within(rail).getByTestId('library-cat-rooms');
    const itemsGroup = within(rail).getByTestId('library-cat-items');

    expect(within(roomsGroup).getByText('By room')).toBeInTheDocument();
    expect(within(itemsGroup).getByText('By item')).toBeInTheDocument();

    // Ensure By room appears above By item in DOM order.
    const pos = roomsGroup.compareDocumentPosition(itemsGroup);
    expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Key room & furniture categories exist.
    expect(screen.getByTestId('lib-cat-room:bedroom')).toBeInTheDocument();
    expect(screen.getByTestId('lib-cat-room:kitchen')).toBeInTheDocument();
    expect(screen.getByTestId('lib-cat-room:bathroom')).toBeInTheDocument();
    expect(screen.getByTestId('lib-cat-item:beds')).toBeInTheDocument();
    expect(screen.getByTestId('lib-cat-item:storage')).toBeInTheDocument();
  });

  it('shows multi-category items in multiple room and furniture categories', () => {
    render(<LibraryPanel isMobile={false} />);

    // Select Bedroom -> Daybeds & sofa beds shelf appears
    fireEvent.click(screen.getByTestId('lib-cat-room:bedroom'));
    expect(screen.getByTestId('lib-cat-room:bedroom')).toHaveAttribute('aria-pressed', 'true');
    const grid = screen.getByTestId('asset-grid');
    expect(within(grid).getByText('Daybeds & sofa beds')).toBeInTheDocument();

    // Select Living room -> Daybeds & sofa beds ALSO appears
    fireEvent.click(screen.getByTestId('lib-cat-room:living'));
    expect(within(grid).getByText('Daybeds & sofa beds')).toBeInTheDocument();

    // Select Beds (By item) -> Daybeds & sofa beds ALSO appears
    fireEvent.click(screen.getByTestId('lib-cat-item:beds'));
    expect(within(grid).getByText('Daybeds & sofa beds')).toBeInTheDocument();

    // Select Sofas & chairs (By item) -> Daybeds & sofa beds ALSO appears
    fireEvent.click(screen.getByTestId('lib-cat-item:seating'));
    expect(within(grid).getByText('Daybeds & sofa beds')).toBeInTheDocument();
  });

  it('places Structure as a top-level tab between Furniture and Materials and shows shape windows in the Windows build tab', () => {
    render(<LibraryPanel isMobile={false} />);
    const furnitureTab = screen.getByTestId('lib-tab-furniture');
    const structureTab = screen.getByTestId('lib-tab-structure');
    const materialsTab = screen.getByTestId('lib-tab-materials');

    expect(furnitureTab.compareDocumentPosition(structureTab) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(structureTab.compareDocumentPosition(materialsTab) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByTestId('lib-cat-item:structure')).toBeNull();

    fireEvent.click(structureTab);
    expect(screen.getByTestId('structure-tab')).toBeInTheDocument();
    expect(screen.getByTestId('lib-struct-windows')).toBeInTheDocument();
    expect(screen.getByTestId('lib-struct-Partitions')).toBeInTheDocument();

    act(() => {
      useEditorStore.setState({ libraryTab: 'build', buildGroup: 'windows' });
    });
    const shapeWindowsGrid = screen.getByTestId('shape-windows-grid');
    expect(within(shapeWindowsGrid).getByTestId('asset-portal-frames:rounded-glass-window')).toBeInTheDocument();
  });
});
