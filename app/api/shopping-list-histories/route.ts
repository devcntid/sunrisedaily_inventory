import { NextResponse } from 'next/server';
import { saveShoppingListHistory, getShoppingListHistories } from '@/lib/queries/shopping_list_histories';

export async function GET() {
  try {
    const histories = await getShoppingListHistories();
    return NextResponse.json({ success: true, data: histories });
  } catch (error: any) {
    console.error('Error fetching shopping list histories:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { created_by, created_by_name, total_items, print_data } = body;

    const history = await saveShoppingListHistory(
      created_by,
      created_by_name,
      total_items,
      print_data
    );

    return NextResponse.json({ success: true, data: history });
  } catch (error: any) {
    console.error('Error saving shopping list history:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
