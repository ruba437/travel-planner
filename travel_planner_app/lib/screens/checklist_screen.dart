import 'dart:convert';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';

class ChecklistScreen extends StatefulWidget {
  final String uuid;
  final String title;

  const ChecklistScreen({super.key, required this.uuid, required this.title});

  @override
  State<ChecklistScreen> createState() => _ChecklistScreenState();
}

class _ChecklistScreenState extends State<ChecklistScreen> {
  List<dynamic> _items = [];
  bool _isLoading = true;
  bool _isGenerating = false;
  final TextEditingController _textController = TextEditingController();

  String _getBaseUrl() {
    if (kIsWeb) return 'http://localhost:8888';
    if (Platform.isAndroid) return 'http://10.0.2.2:8888';
    return 'http://127.0.0.1:8888';
  }

  @override
  void initState() {
    super.initState();
    _fetchChecklist();
  }

  // 🌍 取得清單
  Future<void> _fetchChecklist() async {
    final token = Provider.of<AuthProvider>(context, listen: false).token;
    try {
      final res = await http.get(
        Uri.parse('${_getBaseUrl()}/api/itineraries/${widget.uuid}/checklist'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (res.statusCode == 200) {
        setState(() {
          _items = jsonDecode(res.body)['checklistItems'] ?? [];
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('讀取清單失敗: $e');
      setState(() => _isLoading = false);
    }
  }

  // 🌍 新增項目
  Future<void> _addItem() async {
    final text = _textController.text.trim();
    if (text.isEmpty) return;

    final token = Provider.of<AuthProvider>(context, listen: false).token;
    _textController.clear();

    try {
      final res = await http.post(
        Uri.parse('${_getBaseUrl()}/api/itineraries/${widget.uuid}/checklist'),
        headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
        body: jsonEncode({'text': text, 'checked': false}),
      );
      if (res.statusCode == 201) {
        final newItem = jsonDecode(res.body)['item'];
        setState(() => _items.add(newItem));
      }
    } catch (e) {
      debugPrint('新增失敗: $e');
    }
  }

  // 🌍 切換打勾狀態
  Future<void> _toggleCheck(int id, bool currentStatus) async {
    // 樂觀更新 (Optimistic UI)：先讓畫面打勾，再去打 API，感覺更流暢！
    setState(() {
      final index = _items.indexWhere((item) => item['id'] == id);
      if (index != -1) _items[index]['checked'] = !currentStatus;
    });

    final token = Provider.of<AuthProvider>(context, listen: false).token;
    try {
      await http.patch(
        Uri.parse('${_getBaseUrl()}/api/itineraries/${widget.uuid}/checklist/$id'),
        headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
        body: jsonEncode({'checked': !currentStatus}),
      );
    } catch (e) {
      // 失敗的話退回原本狀態
      setState(() {
        final index = _items.indexWhere((item) => item['id'] == id);
        if (index != -1) _items[index]['checked'] = currentStatus;
      });
      debugPrint('更新狀態失敗: $e');
    }
  }

  // 🌍 刪除項目
  Future<void> _deleteItem(int id) async {
    final token = Provider.of<AuthProvider>(context, listen: false).token;
    try {
      await http.delete(
        Uri.parse('${_getBaseUrl()}/api/itineraries/${widget.uuid}/checklist/$id'),
        headers: {'Authorization': 'Bearer $token'},
      );
    } catch (e) {
      debugPrint('刪除失敗: $e');
    }
  }

  // 🤖 呼叫 AI 自動生成清單
  Future<void> _generateByAI() async {
    setState(() => _isGenerating = true);
    final token = Provider.of<AuthProvider>(context, listen: false).token;

    try {
      final res = await http.post(
        Uri.parse('${_getBaseUrl()}/api/itineraries/${widget.uuid}/generate-checklist'),
        headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
        body: jsonEncode({'replaceExisting': false}),
      );
      
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        setState(() {
          _items = data['checklistItems'] ?? [];
        });
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('🤖 AI 已成功為您新增 ${data['addedCount']} 項建議！')),
          );
        }
      }
    } catch (e) {
      debugPrint('AI 生成失敗: $e');
    } finally {
      setState(() => _isGenerating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: Text('${widget.title} • 行李', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF0F766E),
        elevation: 1,
        actions: [
          _isGenerating
              ? const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 20.0),
                  child: Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))),
                )
              : IconButton(
                  icon: const Icon(Icons.auto_awesome),
                  tooltip: 'AI 智能建議',
                  onPressed: _generateByAI,
                ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF0F766E)))
                : _items.isEmpty
                    ? const Center(child: Text('目前沒有清單，點擊右上角讓 AI 幫你想要帶什麼吧！', style: TextStyle(color: Colors.grey)))
                    : ListView.builder(
                        itemCount: _items.length,
                        itemBuilder: (context, index) {
                          final item = _items[index];
                          final bool isChecked = item['checked'] ?? false;

                          // 📱 滑動刪除效果 (Swipe to Delete)
                          return Dismissible(
                            key: Key(item['id'].toString()),
                            direction: DismissDirection.endToStart,
                            background: Container(
                              color: Colors.redAccent,
                              alignment: Alignment.centerRight,
                              padding: const EdgeInsets.only(right: 20),
                              child: const Icon(Icons.delete, color: Colors.white),
                            ),
                            onDismissed: (direction) {
                              _deleteItem(item['id']);
                              setState(() => _items.removeAt(index));
                            },
                            child: CheckboxListTile(
                              title: Text(
                                item['text'] ?? '',
                                style: TextStyle(
                                  fontSize: 16,
                                  decoration: isChecked ? TextDecoration.lineThrough : null,
                                  color: isChecked ? Colors.grey : Colors.black87,
                                ),
                              ),
                              value: isChecked,
                              activeColor: const Color(0xFF0F766E),
                              onChanged: (_) => _toggleCheck(item['id'], isChecked),
                              controlAffinity: ListTileControlAffinity.leading,
                            ),
                          );
                        },
                      ),
          ),
          
          // 底部手動輸入框
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
            decoration: const BoxDecoration(
              color: Colors.white,
              boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 10, offset: Offset(0, -2))],
            ),
            child: SafeArea(
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _textController,
                      decoration: InputDecoration(
                        hintText: '自行新增行李項目...',
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(30), borderSide: BorderSide.none),
                        filled: true,
                        fillColor: Colors.grey[100],
                      ),
                      onSubmitted: (_) => _addItem(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  CircleAvatar(
                    backgroundColor: const Color(0xFF0F766E),
                    child: IconButton(
                      icon: const Icon(Icons.add, color: Colors.white),
                      onPressed: _addItem,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}