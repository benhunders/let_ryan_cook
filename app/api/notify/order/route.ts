import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail, emailLayout } from "@/lib/email";

// Best-effort notification after a customer saves an order. Authorizes via the
// session and re-fetches the order server-side (never trusts client content):
//   • confirmation to the customer
//   • new-order alert to admins (Ryan)
export async function POST(request: Request) {
  const { menuId } = await request.json().catch(() => ({ menuId: null }));
  if (!menuId) {
    return NextResponse.json({ error: "menuId required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, notes")
    .eq("menu_id", menuId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const { data: menu } = await supabase
    .from("menus")
    .select("title")
    .eq("id", menuId)
    .maybeSingle();

  const { data: items } = await supabase
    .from("order_items")
    .select("quantity, note, dish_id")
    .eq("order_id", order.id);

  const dishIds = [...new Set((items ?? []).map((i) => i.dish_id))];
  const { data: dishes } = dishIds.length
    ? await supabase.from("dishes").select("id, name").in("id", dishIds)
    : { data: [] };
  const dishName = new Map((dishes ?? []).map((d) => [d.id, d.name]));

  const lines = (items ?? [])
    .map(
      (i) =>
        `<li>${i.quantity} × ${dishName.get(i.dish_id) ?? "Dish"}${
          i.note ? ` <span style="color:#888">— ${i.note}</span>` : ""
        }</li>`
    )
    .join("");
  const itemsHtml = lines
    ? `<ul>${lines}</ul>`
    : "<p>(No dishes selected.)</p>";
  const menuTitle = menu?.title ?? "this week's menu";
  const customerName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "there";

  // Confirmation to the customer.
  if (user.email) {
    await sendEmail({
      to: user.email,
      subject: `We got your order — ${menuTitle}`,
      html: emailLayout(
        "Order received 🍽️",
        `<p>Thanks! Here's what you ordered for <strong>${menuTitle}</strong>:</p>${itemsHtml}${
          order.notes ? `<p><strong>Your notes:</strong> ${order.notes}</p>` : ""
        }<p>You can tweak it any time from the menu before Ryan starts cooking.</p>`
      ),
    });
  }

  // Alert to admins (any authenticated user may read profiles under RLS).
  const { data: admins } = await supabase
    .from("profiles")
    .select("email")
    .eq("is_admin", true);
  const adminEmails = (admins ?? [])
    .map((a) => a.email)
    .filter((e): e is string => !!e);
  if (adminEmails.length) {
    await sendEmail({
      to: adminEmails,
      subject: `New order from ${customerName} — ${menuTitle}`,
      html: emailLayout(
        "New order 🧑‍🍳",
        `<p><strong>${customerName}</strong> ordered for <strong>${menuTitle}</strong>:</p>${itemsHtml}${
          order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ""
        }`
      ),
    });
  }

  return NextResponse.json({ ok: true });
}
