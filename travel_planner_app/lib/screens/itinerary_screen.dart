import 'dart:convert';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../providers/auth_provider.dart';
import 'map_screen.dart';
import 'checklist_screen.dart'; // 🆕 引入你寫好的行前清單畫面
import '../theme/app_theme.dart';

class ItineraryScreen extends StatefulWidget {
  final Map<String, dynamic>? tripData; 

  const ItineraryScreen({super.key, this.tripData});

  @override
  State<ItineraryScreen> createState() => _ItineraryScreenState();
}

class _ItineraryScreenState extends State<ItineraryScreen> {
  late String _displayTitle;
  late String _displayNote;
  Map<String, dynamic>? _localPlan; // 🆕 獨立的本地資料狀態

  @override
  void initState() {
    super.initState();
    if (widget.tripData != null) {
      _displayTitle = widget.tripData!['title'] ?? '未命名行程';
      dynamic planData = widget.tripData!['itinerarydata'] ?? widget.tripData!['itineraryData'] ?? {};
      if (planData is String) {
        try { planData = jsonDecode(planData); } catch (_) { planData = {}; }
      }
      _localPlan = planData;
      _displayNote = widget.tripData!['note'] ?? planData['tripNote'] ?? '';
    }
  }

  String _getBaseUrl() {
    if (kIsWeb) return 'http://localhost:8888';
    if (Platform.isAndroid) return 'http://10.0.2.2:8888';
    return 'http://127.0.0.1:8888';
  }

  Future<void> _launchMaps(double lat, double lng, String name) async {
    final Uri url = Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$lat,$lng');
    if (!await launchUrl(url, mode: LaunchMode.externalApplication)) debugPrint('無法開啟地圖');
  }

  Future<void> _editItineraryInfo() async {
    final titleCtrl = TextEditingController(text: _displayTitle);
    final noteCtrl = TextEditingController(text: _displayNote);

    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('編輯行程資訊', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: titleCtrl, decoration: const InputDecoration(labelText: '行程標題', border: OutlineInputBorder())), const SizedBox(height: 16),
          TextField(controller: noteCtrl, maxLines: 3, decoration: const InputDecoration(labelText: '旅遊備註', border: OutlineInputBorder())),
        ])),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), style: FilledButton.styleFrom(backgroundColor: const Color(0xFF0F766E)), child: const Text('儲存並同步')),
        ],
      ),
    );

    if (result == true) {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      showDialog(context: context, barrierDismissible: false, builder: (ctx) => const Center(child: CircularProgressIndicator()));

      try {
        final String uuid = widget.tripData!['uuid'];
        final response = await http.put(
          Uri.parse('${_getBaseUrl()}/api/itineraries/$uuid'),
          headers: { 'Authorization': 'Bearer ${auth.token}', 'Content-Type': 'application/json' },
          body: jsonEncode({ 'title': titleCtrl.text, 'tripNote': noteCtrl.text, 'itineraryData': _localPlan }),
        );

        if (mounted) Navigator.pop(context); 
        if (response.statusCode == 200) {
          setState(() { _displayTitle = titleCtrl.text; _displayNote = noteCtrl.text; });
          if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('✅ 同步更新成功！')));
        }
      } catch (e) {
        if (mounted) Navigator.pop(context);
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('❌ 同步失敗')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final plan = _localPlan; 

    if (plan == null || plan.isEmpty) {
      return const Scaffold(body: Center(child: Text('暫無行程資料')));
    }

    final String summary = plan['summary'] ?? '精彩旅程';
    final List<dynamic> days = plan['days'] ?? [];

    return DefaultTabController(
      length: days.length,
      child: Scaffold(
        backgroundColor: AppColors.bg,
        appBar: AppBar(
          title: Text(_displayTitle, style: const TextStyle(fontWeight: FontWeight.bold)),
          backgroundColor: AppColors.surface, surfaceTintColor: AppColors.surface, elevation: 1,
          actions: [
            // 🎒 🆕 行前清單按鈕 (只有已經存檔的舊行程才能使用清單，因為需要 UUID 去呼叫 API)
            if (widget.tripData != null)
              IconButton(
                icon: const Icon(Icons.luggage_outlined, color: AppColors.orange),
                tooltip: '行前行李清單',
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => ChecklistScreen(
                        uuid: widget.tripData!['uuid'], // 傳入 UUID
                        title: _displayTitle,           // 傳入目前的標題
                      ),
                    ),
                  );
                },
              ),
            IconButton(icon: const Icon(Icons.map_outlined, color: AppColors.orange), onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (context) => MapScreen(plan: plan)))),
            IconButton(icon: const Icon(Icons.edit_note, color: AppColors.orange), onPressed: _editItineraryInfo),
          ],
          bottom: TabBar(isScrollable: days.length > 4, indicatorColor: AppColors.orange, labelColor: AppColors.orange, tabs: days.map((dayObj) => Tab(text: '第 ${dayObj['day'] ?? 1} 天')).toList()),
        ),
        body: Column(children: [
          Container(width: double.infinity, padding: const EdgeInsets.all(16), color: AppColors.teal.withOpacity(0.08), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('💡 概要：$summary', style: const TextStyle(fontSize: 14, color: AppColors.orange, fontWeight: FontWeight.bold)),
            if (_displayNote.isNotEmpty) ...[const SizedBox(height: 8), Text('📝 筆記：$_displayNote', style: const TextStyle(fontSize: 13, color: AppColors.teal))]
          ])),
          Expanded(child: TabBarView(children: days.map((dayObj) {
            final List<dynamic> items = dayObj['items'] ?? [];
            if (items.isEmpty) return const Center(child: Text('今天無行程', style: TextStyle(color: Colors.grey)));
            return ListView.builder(padding: const EdgeInsets.all(20), itemCount: items.length, itemBuilder: (context, idx) {
              final item = items[idx];
              return _buildTimelineTile(time: item['time'] ?? '09:00', name: item['name'] ?? '', type: item['type'] ?? '', note: item['note'] ?? '', cost: item['cost'] ?? 0, currency: plan['currency'] ?? 'TWD', isLast: idx == items.length - 1, lat: double.tryParse(item['lat']?.toString() ?? ''), lng: double.tryParse(item['lng']?.toString() ?? ''));
            });
          }).toList())),
        ]),
      ),
    );
  }

  Widget _buildTimelineTile({required String time, required String name, required String type, required String note, required num cost, required String currency, required bool isLast, double? lat, double? lng}) {
    IconData iconData = Icons.place;
    Color iconColor = AppColors.orange;
    if (type == 'food') {
      iconData = Icons.restaurant;
      iconColor = AppColors.orange;
    } else if (type == 'shopping') {
      iconData = Icons.shopping_bag;
      iconColor = Colors.purple;
    } else if (type == 'activity') {
      iconData = Icons.local_activity;
      iconColor = Colors.blue;
    }
    return IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Column(children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(color: iconColor.withOpacity(0.15), shape: BoxShape.circle),
            child: Icon(iconData, size: 18, color: iconColor),
          ),
          Expanded(child: isLast ? const SizedBox(height: 20) : Container(width: 2, color: AppColors.border))
        ]),
        const SizedBox(width: 16),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 24.0),
            child: Card(
              margin: EdgeInsets.zero,
              elevation: 1,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              color: AppColors.surface,
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                    Text(time, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black54)),
                    if (cost > 0)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(color: Colors.amber[50], borderRadius: BorderRadius.circular(4)),
                        child: Text('$currency $cost', style: TextStyle(color: Colors.amber[800], fontSize: 12, fontWeight: FontWeight.bold)),
                      )
                  ]),
                  const SizedBox(height: 6),
                  Text(name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  if (note.isNotEmpty) ...[const SizedBox(height: 8), Text(note, style: TextStyle(fontSize: 14, color: Colors.grey))],
                    if (lat != null && lng != null) ...[
                    const SizedBox(height: 12),
                    Align(
                      alignment: Alignment.centerRight,
                      child: FilledButton.icon(
                        onPressed: () => _launchMaps(lat, lng, name),
                        style: FilledButton.styleFrom(backgroundColor: AppColors.orange, foregroundColor: Colors.white, elevation: 0),
                        icon: const Icon(Icons.directions_walk, size: 18),
                        label: const Text('帶我去'),
                      ),
                    )
                  ]
                ]),
              ),
            ),
          ),
        ),
      ]),
    );
  }
}