import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag, revalidatePath } from 'next/cache';

export async function POST(req: NextRequest) {
    const authHeader = req.headers.get('x-revalidate-secret');
    if (!authHeader || authHeader !== process.env.REVALIDATE_SECRET) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const body = await req.json();
        const tags: string[] = body.tags || [];
        const paths: string[] = body.paths || [];

        // Purge tags
        for (const tag of tags) {
            revalidateTag(tag);
        }

        // Purge paths
        for (const p of paths) {
            revalidatePath(p, 'page');
        }

        return NextResponse.json({ revalidated: true, now: Date.now() });
    } catch (err) {
        return new NextResponse('Error parsing body', { status: 400 });
    }
}
