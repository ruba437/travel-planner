import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/planner_provider.dart';

class ItineraryScreen extends StatelessWidget {
  const ItineraryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final planner = Provider.of<PlannerProvider>(context);
    final plan = planner.currentPlan;

    // 防呆：如果根本沒有行程資料，按返回
    if (plan == null) {
      return const Scaffold(body: Center(child: Text('暫無行程資料')));
    }

    final String city = plan['city'] ?? '未決定城市';
    final String summary = plan['summary'] ?? '精彩旅程';
    final List<dynamic> days = plan['days'] ?? [];

    // 使用 DefaultTabController 來自動處理 Day 1, Day 2 的分頁滑動
    return DefaultTabController(
      length: days.length,
      child: Scaffold(
        backgroundColor: Colors.grey[50],
        appBar: AppBar(
          title: Text('$city • 詳細行程', style: const TextStyle(fontWeight: FontWeight.bold)),
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.white,
          elevation: 1,
          bottom: TabBar(
            isScrollable: days.length > 4, // 天數太多時允許橫向滑動頁籤
            indicatorColor: const Color(0xFF0F766E),
            labelColor: const Color(0xFF0F766E),
            unselectedLabelColor: Colors.black54,
            tabs: days.map((dayObj) {
              return Tab(text: '第 ${dayObj['day'] ?? 1} 天');
            }).toList(),
          ),
        ),
        body: Column(
          children: [
            // 頂部概要橫幅
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              color: const Color(0xFFE6F4F1),
              child: Text(
                '💡 AI 規劃概要：$summary',
                style: const TextStyle(fontSize: 14, color: Color(0xFF0F766E), fontWeight: FontWeight.w500),
              ),
            ),
            
            // 行程內容分頁區
            Expanded(
              child: TabBarView(
                children: days.map((dayObj) {
                  final List<dynamic> items = dayObj['items'] ?? [];
                  
                  if (items.isEmpty) {
                    return const Center(child: Text('今天沒有安排行程喔。', style: TextStyle(color: Colors.grey)));
                  }

                  return ListView.builder(
                    padding: const EdgeInsets.all(20),
                    itemCount: items.length,
                    itemBuilder: (context, idx) {
                      final item = items[idx];
                      final bool isLast = idx == items.length - 1; // 判斷是否為最後一個項目
                      
                      return _buildTimelineTile(
                        time: item['time'] ?? '09:00',
                        name: item['name'] ?? '未知景點',
                        type: item['type'] ?? 'sight',
                        note: item['note'] ?? '',
                        cost: item['cost'] ?? 0,
                        currency: plan['currency'] ?? 'TWD',
                        isLast: isLast,
                      );
                    },
                  );
                }).toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // 核心客製化：時間軸骨架 (點、線、卡片的完美組合)
  Widget _buildTimelineTile({
    required String time,
    required String name,
    required String type,
    required String note,
    required num cost,
    required String currency,
    required bool isLast,
  }) {
    // 依據型態給予不同的圖示與顏色
    IconData iconData = Icons.place;
    Color iconColor = const Color(0xFF0F766E);
    if (type == 'food') {
      iconData = Icons.restaurant;
      iconColor = Colors.orange;
    } else if (type == 'shopping') {
      iconData = Icons.shopping_bag;
      iconColor = Colors.purple;
    } else if (type == 'activity') {
      iconData = Icons.local_activity;
      iconColor = Colors.blue;
    }

    return IntrinsicHeight( // 讓左側的垂直線長度能動態適應右側卡片的高度
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 左側時間軸線條區
          Column(
            children: [
              // 景點小圓點 (外圈)
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: iconColor.withOpacity(0.15),
                  shape: BoxShape.circle,
                ),
                child: Icon(iconData, size: 18, color: iconColor),
              ),
              // 連接下一格的垂直線 (如果是最後一個項目就不用畫線了)
              Expanded(
                child: isLast
                    ? const SizedBox(height: 20)
                    : Container(
                        width: 2,
                        color: Colors.grey[300],
                      ),
              ),
            ],
          ),
          const SizedBox(width: 16),
          
          // 右側行程內容卡片區
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 24.0), // 留白讓卡片之間有呼吸感
              child: Card(
                margin: EdgeInsets.zero,
                elevation: 1,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                color: Colors.white,
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // 時間與花費標籤
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(time, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black54, fontSize: 14)),
                          if (cost > 0)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(color: Colors.amber[50], borderRadius: BorderRadius.circular(4)),
                              child: Text('$currency $cost', style: TextStyle(color: Colors.amber[800], fontSize: 12, fontWeight: FontWeight.bold)),
                            ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      
                      // 景點名稱
                      Text(name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.black87)),
                      
                      // 備註說明
                      if (note.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Text(note, style: TextStyle(fontSize: 14, color: Colors.grey[600], height: 1.4)),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}