import { Menu, MenuItem } from "@blueprintjs/core";
import { SortAsc, SortDesc } from "@blueprintjs/icons";
import { CellRenderer, Column, ColumnHeaderCell } from "@blueprintjs/table";

export type SortCallback<Data = any> = (
  columnId: string,
  comparator: (a: Data, b: Data) => number,
) => void;

export interface SortableColumn<Data> {
  getColumn(
    cellRenderer: CellRenderer,
    sortColumn: SortCallback<Data>,
  ): React.JSX.Element;
}

abstract class AbstractSortableColumn<Data> implements SortableColumn<Data> {
  constructor(
    protected name: string,
    protected columnId: string,
  ) {}

  public getColumn(cellRenderer: CellRenderer, sortColumn: SortCallback<Data>) {
    const menuRenderer = this.renderMenu.bind(this, sortColumn);
    const columnHeaderCellRenderer = () => (
      <ColumnHeaderCell name={this.name} menuRenderer={menuRenderer} />
    );
    return (
      <Column
        cellRenderer={cellRenderer}
        columnHeaderCellRenderer={columnHeaderCellRenderer}
        key={this.columnId}
        name={this.name}
      />
    );
  }

  protected abstract renderMenu(sortColumn: SortCallback): React.JSX.Element;
}

export class ScoreSortableColumn extends AbstractSortableColumn<
  number | undefined
> {
  protected renderMenu(sortColumn: SortCallback) {
    const sortAsc = () =>
      sortColumn(this.columnId, (a, b) => this.compare(a, b));
    const sortDesc = () =>
      sortColumn(this.columnId, (a, b) => this.compare(b, a));
    return (
      <Menu>
        <MenuItem icon={<SortAsc />} onClick={sortAsc} text="Sort Asc" />
        <MenuItem icon={<SortDesc />} onClick={sortDesc} text="Sort Desc" />
      </Menu>
    );
  }

  private compare(a: number, b: number) {
    return a < b ? 1 : -1;
  }
}
