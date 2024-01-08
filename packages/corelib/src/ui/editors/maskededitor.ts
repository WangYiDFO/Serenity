﻿import { Fluent, getjQuery } from "@serenity-is/base";
import { Decorators } from "../../decorators";
import { IStringValue } from "../../interfaces";
import { EditorWidget, EditorProps } from "../widgets/widget";

// http://digitalbush.com/projects/masked-input-plugin/
@Decorators.registerEditor('Serenity.MaskedEditor', [IStringValue])
@Decorators.element("<input type=\"text\"/>")
export class MaskedEditor<P extends MaskedEditorOptions = MaskedEditorOptions> extends EditorWidget<P> {

    declare readonly domNode: HTMLInputElement;

    constructor(props: EditorProps<P>) {
        super(props);

        let $ = getjQuery();
        if ($?.fn?.mask) {
            $(this.domNode).mask(this.options.mask || '', {
                placeholder: (this.options.placeholder ?? '_')
            });
        }
    }

    public get value(): string {
        Fluent.trigger(this.domNode, "blur.mask");
        return this.domNode.value;
    }

    protected get_value(): string {
        return this.value;
    }

    public set value(value: string) {
        this.domNode.value = value;
    }

    protected set_value(value: string): void {
        this.value = value;
    }
}

export interface MaskedEditorOptions {
    mask?: string;
    placeholder?: string;
}