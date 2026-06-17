import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail, emailLayout } from "@/lib/email";
import { statusLabel } from "@/lib/orderStatus";

// Best-effort notification after an admin changes an order's status. Authorizes
// that the caller is an admin, then emails the order's customer the new status.
export async function POST(request: Request) {
  const { orderId } = await request.json().catch(() => ({ orderId: null }));
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { data: me } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!me?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: order } = await supabase
    .from("orders")
    .select("status, user_id, menu_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const { data: customer } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", order.user_id)
    .maybeSingle();
  const { data: menu } = await supabase
    .from("menus")
    .select("title")
    .eq("id", order.menu_id)
    .maybeSingle();

  const menuTitle = menu?.title ?? "your order";
  if (customer?.email) {
    await sendEmail({
      to: customer.email,
      subject: `Order update — ${statusLabel(order.status)}`,
      html: emailLayout(
        "Order update 🔔",
        `<p>Your order for <strong>${menuTitle}</strong> is now:</p>
         <p style="font-size:18px;font-weight:600;">${statusLabel(order.status)}</p>`
      ),
    });
  }

  return NextResponse.json({ ok: true });
}
