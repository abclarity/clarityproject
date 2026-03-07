// scripts/cell-selection.js
// Google Sheets-style Cell Selection & Editing with Multi-Selection

(function(window) {
  'use strict';

  // === State Management (Multi-Selection) ===
  let selectedCells = new Set();
  let lastSelectedCell = null;
  let editingCell = null;
  let copiedCells = new Map();
  let isExitingEditMode = false;

  // Drag State
  let dragState = {
    isMouseDown: false,
    isDragging: false,
    startCell: null,
    boundary: null
  };

  // === Boundary Detection ===
  function getCellBoundary(cell) {
    if (!cell) return null;

    if (cell.closest('thead')) return 'header';
    if (cell.closest('tbody')) return 'body';

    const tr = cell.closest('tr');
    if (!tr) return null;

    if (tr.id === 'summary-row' || tr.id === 'year-summary' || tr.id === 'summary-head' || tr.id === 'year-head') return 'total';
    if (tr.dataset.week) return 'weekly';
    if (tr.dataset.quarter) return 'quarterly';
    if (tr.id === 'weekly-header') return 'weekly';

    const tfoot = cell.closest('tfoot');
    if (tfoot) {
      if (tr.dataset.week) return 'weekly';
      return 'total';
    }

    return 'other';
  }

  function canSelectTogether(cell1, cell2) {
    const b1 = getCellBoundary(cell1);
    const b2 = getCellBoundary(cell2);

    if (!b1 || !b2) return false;

    // Body und Total können zusammen selektiert werden
    if ((b1 === 'body' || b1 === 'total') && (b2 === 'body' || b2 === 'total')) {
      return true;
    }

    return b1 === b2;
  }

  // === State Management Functions ===
  function clearAllSelections() {
    selectedCells.forEach(cell => {
      cell.classList.remove('cell-selected');
    });
    selectedCells.clear();
  }

  function clearEditing() {
    if (editingCell) {
      editingCell.classList.remove('cell-editing');
      const input = editingCell.querySelector('input');
      if (input) {
        input.blur();
        input.style.pointerEvents = 'none';
      }
      editingCell = null;
    }
  }

  function clearCopyState() {
    copiedCells.forEach((data, cell) => {
      cell.classList.remove('cell-copying');
    });
    copiedCells.clear();
  }

  // === Selection Functions ===
  function isSelectableCell(td) {
    if (!td || !td.tagName) return false;
    if (td.tagName !== 'TD') return false;

    if (td.querySelector('input')) return true;
    if (td.classList.contains('calc')) return true;
    if (td.closest('tfoot')) return true;

    return false;
  }

  function selectCell(td, addToSelection = false) {
    if (!isSelectableCell(td)) return;

    if (!addToSelection) {
      clearAllSelections();
    }

    selectedCells.add(td);
    td.classList.add('cell-selected');
    lastSelectedCell = td;
  }

  function deselectCell(td) {
    td.classList.remove('cell-selected');
    selectedCells.delete(td);
  }

  function toggleCell(td) {
    if (selectedCells.has(td)) {
      deselectCell(td);
    } else {
      selectCell(td, true);
    }
    lastSelectedCell = td;
  }

  function selectRange(startCell, endCell) {
    if (!startCell || !endCell) return;
    if (!canSelectTogether(startCell, endCell)) return;

    const allCells = getAllSelectableCells();
    const startIdx = allCells.indexOf(startCell);
    const endIdx = allCells.indexOf(endCell);

    if (startIdx === -1 || endIdx === -1) return;

    const minIdx = Math.min(startIdx, endIdx);
    const maxIdx = Math.max(startIdx, endIdx);

    clearAllSelections();

    for (let i = minIdx; i <= maxIdx; i++) {
      const cell = allCells[i];
      if (canSelectTogether(startCell, cell)) {
        selectCell(cell, true);
      }
    }
  }

  function enterEditMode(td) {
    if (!td || isExitingEditMode) return;

    const input = td.querySelector('input');
    if (!input) return;

    clearAllSelections();
    clearEditing();

    editingCell = td;
    td.classList.add('cell-editing');

    input.style.pointerEvents = 'auto';
    input.focus();

    if (input.value) {
      setTimeout(() => input.select(), 0);
    }
  }

  function exitEditMode(save = true) {
    if (!editingCell) return;

    isExitingEditMode = true;

    const td = editingCell;
    const input = td.querySelector('input');

    if (input && save) {
      input.blur();
    }

    td.classList.remove('cell-editing');
    if (input) {
      input.style.pointerEvents = 'none';
    }

    editingCell = null;

    setTimeout(() => {
      isExitingEditMode = false;
    }, 150);
  }

  // === Get All Selectable Cells ===
  function getAllSelectableCells() {
    const tables = document.querySelectorAll('table');
    const cells = [];

    tables.forEach(table => {
      const allTds = table.querySelectorAll('td');
      allTds.forEach(td => {
        if (isSelectableCell(td)) {
          cells.push(td);
        }
      });
    });

    return cells;
  }

  // === Navigation ===
  function getAdjacentCell(td, direction) {
    const cells = getAllSelectableCells();
    const currentIndex = cells.indexOf(td);

    if (currentIndex === -1) return null;

    switch (direction) {
      case 'up':
        const currentCol = Array.from(td.parentElement.children).indexOf(td);
        let prevRow = td.parentElement.previousElementSibling;
        while (prevRow) {
          const targetCell = prevRow.children[currentCol];
          if (targetCell && isSelectableCell(targetCell)) {
            return targetCell;
          }
          prevRow = prevRow.previousElementSibling;
        }
        return null;

      case 'down':
        const colIndex = Array.from(td.parentElement.children).indexOf(td);
        let nextRow = td.parentElement.nextElementSibling;
        while (nextRow) {
          const targetCell = nextRow.children[colIndex];
          if (targetCell && isSelectableCell(targetCell)) {
            return targetCell;
          }
          nextRow = nextRow.nextElementSibling;
        }
        return null;

      case 'left':
        return currentIndex > 0 ? cells[currentIndex - 1] : null;

      case 'right':
        return currentIndex < cells.length - 1 ? cells[currentIndex + 1] : null;

      case 'next':
        return currentIndex < cells.length - 1 ? cells[currentIndex + 1] : null;

      case 'prev':
        return currentIndex > 0 ? cells[currentIndex - 1] : null;

      default:
        return null;
    }
  }

  function navigateToCell(direction) {
    const current = editingCell || lastSelectedCell;
    if (!current) return;

    const nextCell = getAdjacentCell(current, direction);
    if (nextCell) {
      selectCell(nextCell);
    }
  }

  // === Copy/Paste (Multi-Selection) ===
  function copyCell() {
    if (selectedCells.size === 0) return;

    clearCopyState();

    let hasCopiedAny = false;

    selectedCells.forEach(cell => {
      const input = cell.querySelector('input');
      if (!input || !input.dataset.key) return;

      const key = input.dataset.key;
      const data = getCurrentMonthData();
      const value = data[key];

      if (value !== undefined) {
        copiedCells.set(cell, { key, value });
        cell.classList.add('cell-copying');
        hasCopiedAny = true;
      }
    });
  }

  function pasteCell() {
    if (copiedCells.size === 0 || selectedCells.size === 0) return;

    const copiedArray = Array.from(copiedCells.entries());
    const selectedArray = Array.from(selectedCells);

    if (copiedArray.length === 1) {
      const [, copiedData] = copiedArray[0];

      selectedArray.forEach(targetCell => {
        const input = targetCell.querySelector('input');
        if (!input || !input.dataset.key) return;

        pasteValueToCell(input, copiedData.value);
      });
    } else if (selectedArray.length === 1) {
      const startCell = selectedArray[0];
      const allCells = getAllSelectableCells();
      const startIdx = allCells.indexOf(startCell);

      copiedArray.forEach(([, copiedData], idx) => {
        const targetCell = allCells[startIdx + idx];
        if (!targetCell) return;

        const input = targetCell.querySelector('input');
        if (!input || !input.dataset.key) return;

        pasteValueToCell(input, copiedData.value);
      });
    } else if (copiedArray.length === selectedArray.length) {
      copiedArray.forEach(([, copiedData], idx) => {
        const targetCell = selectedArray[idx];
        if (!targetCell) return;

        const input = targetCell.querySelector('input');
        if (!input || !input.dataset.key) return;

        pasteValueToCell(input, copiedData.value);
      });
    }

    clearCopyState();
    recalculateAll();
  }

  function pasteValueToCell(input, value) {
    const targetKey = input.dataset.key;
    const data = getCurrentMonthData();
    data[targetKey] = value;

    const [y, mIdx] = getCurrentMonthParams();
    const activeFunnelId = FunnelAPI.getActiveFunnel();
    StorageAPI.saveMonthDataForFunnel(activeFunnelId, y, mIdx, data);

    const col = targetKey.split('_')[0];
    const isEuro = ['Adspend', 'Revenue', 'Cash'].includes(col);
    input.value = isEuro ? ClarityFormat.euro.format(value) : ClarityFormat.int0.format(value);
  }

  function recalculateAll() {
    if (window.MonthView && window.MonthView.recalculate) {
      window.MonthView.recalculate();
    }
  }

  // === Helper: Get current month data ===
  function getCurrentMonthData() {
    const activeFunnelId = FunnelAPI.getActiveFunnel();
    const [y, mIdx] = getCurrentMonthParams();
    return StorageAPI.loadMonthDataForFunnel(activeFunnelId, y, mIdx);
  }

  function getCurrentMonthParams() {
    const firstRow = document.querySelector('#tracker tbody tr[data-day]');
    if (!firstRow) return [2025, 0];

    const dateSpan = firstRow.querySelector('.date');
    if (!dateSpan) return [2025, 0];

    const dateText = dateSpan.textContent;
    const [d, m, y] = dateText.split('.');
    const fullYear = 2000 + parseInt(y);
    const monthIndex = parseInt(m) - 1;

    return [fullYear, monthIndex];
  }

  // === Drag Selection ===
function handleMouseDown(e) {
  // 🔥 Ignore clicks on tabs footer
  if (e.target.closest('#tabs') || e.target.closest('footer')) return;

  const td = e.target.closest('td');
  if (!isSelectableCell(td)) return;

  if (editingCell) return;

  const isCmd = e.metaKey || e.ctrlKey;
  const isShift = e.shiftKey;

  // Shift+Click: Range-Selection
  if (isShift && lastSelectedCell) {
    e.preventDefault();
    selectRange(lastSelectedCell, td);
    dragState.isMouseDown = false;  // 🔥 Kein Drag nach Shift+Click
    return;
  }

  // Cmd+Click: Toggle einzelne Zelle
  if (isCmd) {
    e. preventDefault();
    toggleCell(td);
    dragState.isMouseDown = false;  // 🔥 Kein Drag nach Cmd+Click
    return;
  }

  // Normaler Click: Warte auf mouseup/mousemove
  e.preventDefault();
  
  dragState.isMouseDown = true;
  dragState.isDragging = false;
  dragState.startCell = td;
  dragState.boundary = getCellBoundary(td);
}

  function handleMouseMove(e) {
    if (!dragState.isMouseDown || editingCell) return;

    dragState.isDragging = true;

    const td = e.target.closest('td');
    if (!isSelectableCell(td)) return;

    const boundary = getCellBoundary(td);
    if (boundary !== dragState.boundary) return;

    if (!canSelectTogether(dragState.startCell, td)) return;

    // Get column and row indices
    const startRow = dragState.startCell.parentElement;
    const currentRow = td.parentElement;
    const startColIdx = Array.from(startRow.children).indexOf(dragState.startCell);
    const currentColIdx = Array.from(currentRow.children).indexOf(td);

    const rows = Array.from(dragState.startCell.closest('table').querySelectorAll('tr'));
    const startRowIdx = rows.indexOf(startRow);
    const currentRowIdx = rows.indexOf(currentRow);

    clearAllSelections();

    // Rectangle selection: select all cells in the bounding box
    const minRowIdx = Math.min(startRowIdx, currentRowIdx);
    const maxRowIdx = Math.max(startRowIdx, currentRowIdx);
    const minColIdx = Math.min(startColIdx, currentColIdx);
    const maxColIdx = Math.max(startColIdx, currentColIdx);

    for (let rowIdx = minRowIdx; rowIdx <= maxRowIdx; rowIdx++) {
      const row = rows[rowIdx];
      if (!row) continue;

      for (let colIdx = minColIdx; colIdx <= maxColIdx; colIdx++) {
        const cell = row.children[colIdx];
        if (cell && isSelectableCell(cell) && getCellBoundary(cell) === dragState.boundary) {
          selectCell(cell, true);
        }
      }
    }
  }

  function handleMouseUp(e) {
  if (!dragState.isMouseDown) return;

  const td = dragState.startCell;

  // 🔥 KEIN Drag passiert → normaler Click
  if (!dragState.isDragging && td && isSelectableCell(td)) {
    // Clear alte Selektion und wähle nur diese Zelle
    clearAllSelections();
    selectCell(td, false);
  }

  // 🔥 Drag passiert → Selektion bleibt! 
  // (nichts tun, selectedCells bleibt wie es ist)

  // Reset Drag State
  dragState.isMouseDown = false;
  dragState.isDragging = false;
  dragState.startCell = null;
  dragState.boundary = null;
}

  // === Keyboard Handling ===
  function setupKeyboardHandling() {
    document.addEventListener('keydown', (e) => {
      if (editingCell) {
        if (e.key === 'Escape') {
          e.preventDefault();
          const currentCell = editingCell;
          exitEditMode(false);
          setTimeout(() => selectCell(currentCell), 160);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const currentCell = editingCell;
          exitEditMode(true);
          setTimeout(() => {
            const nextCell = getAdjacentCell(currentCell, 'down');
            if (nextCell) selectCell(nextCell);
          }, 160);
        } else if (e.key === 'Tab') {
          e.preventDefault();
          const currentCell = editingCell;
          const direction = e.shiftKey ? 'prev' : 'next';
          exitEditMode(true);
          setTimeout(() => {
            const nextCell = getAdjacentCell(currentCell, direction);
            if (nextCell) selectCell(nextCell);
          }, 160);
        }
        return;
      }

      if (lastSelectedCell) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          navigateToCell('up');
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          navigateToCell('down');
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          navigateToCell('left');
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          navigateToCell('right');
        } else if (e.key === 'Enter') {
          e.preventDefault();
          enterEditMode(lastSelectedCell);
        } else if (e.key === 'Tab') {
          e.preventDefault();
          navigateToCell(e.shiftKey ? 'prev' : 'next');
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
          e.preventDefault();
          copyCell();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
          e.preventDefault();
          pasteCell();
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const input = lastSelectedCell.querySelector('input');
          if (input) {
            e.preventDefault();
            enterEditMode(lastSelectedCell);
            input.value = e.key;
          }
        }
      }
    });
  }

// === Setup Cell Handlers ===
function setupCell(td, input) {
  if (! td) return;

  // ❌ ALLE Click-Handler ENTFERNEN! 
  // Die Selektion wird NUR über globale mousedown/mousemove/mouseup gesteuert! 

  if (input) {
    // Doppelklick → Edit Mode
    td.addEventListener('dblclick', (e) => {
      e. preventDefault();
      e.stopPropagation();
      enterEditMode(td);
    });

    // Blur → Exit Edit Mode
    input.addEventListener('blur', (e) => {
      setTimeout(() => {
        if (editingCell === td && ! isExitingEditMode) {
          exitEditMode(true);
        }
      }, 100);
    });
  }
}

  // === Global Mouse Handlers ===
  document.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  document.addEventListener('click', (e) => {
    // 🔥 Ignore clicks on tabs footer
    if (e.target.closest('#tabs') || e.target.closest('footer')) return;

    const clickedCell = e.target.closest('td');

    // Clear nur wenn AUSSERHALB einer Tabelle geklickt wurde
  if (! clickedCell && !editingCell && !e.target.closest('table')) {
    clearAllSelections();
  }
});

  // === Public API ===
  window.CellSelection = {
    setupCell,
    setupKeyboardHandling,
    clearAllSelections,
    clearEditing,
    selectCell,
    enterEditMode,
    isSelectableCell,
    getAllSelectableCells
  };

  setupKeyboardHandling();

})(window);
