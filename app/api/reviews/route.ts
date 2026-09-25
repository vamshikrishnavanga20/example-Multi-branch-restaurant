import { NextResponse } from "next/server";
import { Reviews } from "@/lib/aws/dynamodb";
import { verifySession } from "@/lib/aws/auth";

// GET: Fetch reviews
// Public: ?published=true (for guestbook)
// Admin: all reviews (requires session)
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const publishedOnly = url.searchParams.get("published") === "true";
    const limit = Number(url.searchParams.get("limit")) || 50;

    if (publishedOnly) {
      const reviews = await Reviews.listPublished(limit);
      return NextResponse.json(reviews);
    }

    // Admin view: all reviews
    const { authenticated } = await verifySession();
    if (!authenticated) {
      // Fall back to published-only for unauthenticated requests
      const reviews = await Reviews.listPublished(limit);
      return NextResponse.json(reviews);
    }

    const reviews = await Reviews.listAll();
    return NextResponse.json(reviews);
  } catch (error: any) {
    console.error("Reviews GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch reviews." }, { status: 500 });
  }
}

// POST: Submit a new review (Public)
export async function POST(req: Request) {
  try {
    const { customer_name, rating, comment } = await req.json();

    if (!customer_name?.trim() || !comment?.trim()) {
      return NextResponse.json({ error: "Name and comment are required." }, { status: 400 });
    }

    const review = await Reviews.put({
      customer_name: customer_name.trim(),
      rating: Math.min(5, Math.max(1, Number(rating) || 5)),
      comment: comment.trim(),
      is_published: false, // Requires admin approval
    });

    return NextResponse.json(review, { status: 201 });
  } catch (error: any) {
    console.error("Reviews POST Error:", error);
    return NextResponse.json({ error: "Failed to submit review." }, { status: 500 });
  }
}

// PUT: Update review publish status (Admin only)
export async function PUT(req: Request) {
  try {
    const { authenticated } = await verifySession();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { id, sk, is_published } = await req.json();
    if (!id || !sk || is_published === undefined) {
      return NextResponse.json({ error: "id, sk, and is_published are required." }, { status: 400 });
    }

    const updated = await Reviews.updatePublished(id, sk, is_published);
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Reviews PUT Error:", error);
    return NextResponse.json({ error: "Failed to update review." }, { status: 500 });
  }
}

// DELETE: Delete a review (Admin only)
export async function DELETE(req: Request) {
  try {
    const { authenticated } = await verifySession();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { sk } = await req.json();
    if (!sk) {
      return NextResponse.json({ error: "Review SK is required." }, { status: 400 });
    }

    await Reviews.delete(sk);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Reviews DELETE Error:", error);
    return NextResponse.json({ error: "Failed to delete review." }, { status: 500 });
  }
}
