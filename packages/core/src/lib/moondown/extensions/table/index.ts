import {Compartment, type Extension} from "@codemirror/state";
import {tablePositions} from "./table-position.ts";
import {renderTables} from "./render-tables.ts";

export function tableExtension(): Extension {
    return [
        tablePositions,
        (new Compartment()).of(renderTables)
    ];
}