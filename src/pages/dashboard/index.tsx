import { type JSX } from "react";
import { useGlobalQuery } from "../../app/queries";

export function Page(): JSX.Element {
    const blah = useGlobalQuery();

    return (
        <div className="w-screen block-screen">{JSON.stringify(blah)}</div>
    )
}