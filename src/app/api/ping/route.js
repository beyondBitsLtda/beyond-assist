import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"

export async function GET () {
    const dadosSistema = {
        status: 'online' 
    };

        return NextResponse.json(dadosSistema, { status: 200 });
};


