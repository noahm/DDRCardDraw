import { Button, InputGroup } from "@blueprintjs/core";
import { Cross, DragHandleVertical, Plus } from "@blueprintjs/icons";
import { useRef } from "react";
import { List, arrayMove } from "react-movable";
import { Player, newPlayer } from "../models/Drawing";

/**
 * Cap on the height of the scrollable list region. Once enough players are
 * added to reach it, the list scrolls internally instead of growing the
 * enclosing (vertically-centered) dialog unboundedly and shoving the whole
 * modal around on screen.
 */
const LIST_HEIGHT = "10.5em";

/**
 * A vertical, drag-to-reorder list of players. Each row has a dedicated drag
 * handle (so text can still be selected/edited in the name field), an editable
 * name input, and a remove button, with an "add player" button below.
 *
 * The list is simply the players in display order. Since each player carries a
 * stable id that drawn-card actions reference, reordering/renaming/removing here
 * never invalidates those actions — removals are reconciled by id downstream.
 */
export function PlayerListInput(props: {
  value: Player[];
  onChange: (next: Player[]) => void;
}) {
  const { value: players, onChange } = props;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Index of a freshly-added row that should grab focus once it renders.
  const focusIndexRef = useRef<number | null>(null);

  function renameAt(index: number, name: string) {
    onChange(players.map((p, i) => (i === index ? { ...p, name } : p)));
  }

  function removeAt(index: number) {
    onChange(players.filter((_, i) => i !== index));
  }

  function addPlayer() {
    focusIndexRef.current = players.length;
    onChange([...players, newPlayer(`P${players.length + 1}`)]);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }

  return (
    <>
      <List
        lockVertically
        values={players}
        onChange={({ oldIndex, newIndex }) =>
          onChange(arrayMove(players, oldIndex, newIndex))
        }
        renderList={({ children, props: listProps }) => (
          <div
            ref={(el) => {
              listProps.ref.current = el;
              scrollRef.current = el;
            }}
            style={{ maxHeight: LIST_HEIGHT, overflowY: "auto" }}
          >
            {children}
          </div>
        )}
        renderItem={({ value, props: itemProps, index, isDragged }) => {
          const { key, ...rest } = itemProps;
          return (
            <div
              key={key}
              {...rest}
              style={{
                ...rest.style,
                display: "flex",
                alignItems: "center",
                gap: "4px",
                paddingBottom: "4px",
                listStyleType: "none",
                // The dragged "ghost" is portaled to document.body; give it a
                // z-index that clears Blueprint's overlay so it stays visible.
                zIndex: isDragged ? 9999 : rest.style?.zIndex,
              }}
            >
              <span
                data-movable-handle
                style={{
                  display: "flex",
                  cursor: isDragged ? "grabbing" : "grab",
                  padding: "0 2px",
                }}
              >
                <DragHandleVertical />
              </span>
              <InputGroup
                fill
                value={value.name}
                inputRef={
                  index === focusIndexRef.current
                    ? (el) => {
                        if (el) {
                          el.focus();
                          focusIndexRef.current = null;
                        }
                      }
                    : undefined
                }
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => renameAt(index!, e.currentTarget.value)}
              />
              <Button
                aria-label="Remove player"
                variant="minimal"
                icon={<Cross />}
                disabled={players.length <= 1}
                onClick={() => removeAt(index!)}
              />
            </div>
          );
        }}
      />
      <Button variant="minimal" icon={<Plus />} onClick={addPlayer}>
        Add player
      </Button>
    </>
  );
}
