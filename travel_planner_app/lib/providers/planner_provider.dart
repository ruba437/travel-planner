import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';
import 'dart:io' show Platform;

class PlannerProvider with ChangeNotifier {
  // 動態對齊你的後端 Port
  String get _baseUrl {
    if (kIsWeb) return 'http://localhost:8888';
    if (Platform.isAndroid) return 'http://10.0.2.2:8888';
    return 'http://127.0.0.1:8888';
  }

  List<Map<String, String>> _messages = [
    {'role': 'assistant', 'content': '嗨，我是旅遊小助手！我可以幫你安排行程。'}
  ];
  bool _isSending = false;
  dynamic _currentPlan; // 用來存放 AI 生成的 JSON 行程資料
  List<dynamic>? _currentProposals; // 用來存放 3 個城市的初步提案

  List<Map<String, String>> get messages => _messages;
  bool get isSending => _isSending;
  dynamic get currentPlan => _currentPlan;
  List<dynamic>? get currentProposals => _currentProposals;

  // 1. 發送訊息給 AI (回傳 bool 代表是否成功拿到詳細行程)
  Future<bool> handleSend(String text, String token) async {
    if (text.trim().isEmpty || _isSending) return false;

    _messages.add({'role': 'user', 'content': text});
    _isSending = true;
    notifyListeners();

    bool hasNewPlan = false;

    try {
      final res = await http.post(
        Uri.parse('$_baseUrl/api/chat'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'messages': _messages,
          'currentPlan': _currentPlan,
        }),
      );

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);

        if (data['content'] != null) {
          _messages.add({'role': 'assistant', 'content': data['content']});
        }
        
        if (data['proposals'] != null) {
          _currentProposals = data['proposals'];
        }
        
        if (data['plan'] != null) {
          _currentPlan = data['plan'];
          hasNewPlan = true;
        }
      } else {
        _messages.add({'role': 'assistant', 'content': '抱歉，連線後端失敗了，請稍後再試。'});
      }
    } catch (e) {
      print('AI 請求失敗: $e');
      _messages.add({'role': 'assistant', 'content': '連線發生錯誤，請檢查網路。'});
    } finally {
      _isSending = false;
      notifyListeners();
    }
    
    return hasNewPlan;
  }

  // 2. 展開詳細行程的 API (回傳 bool 代表是否成功拿到詳細行程)
  Future<bool> expandPlanDetail(dynamic proposal, String token) async {
    _isSending = true;
    _currentProposals = null; // 點擊瞬間清空卡片，讓畫面乾淨！
    notifyListeners();

    bool hasNewPlan = false;

    final String proposalTitle = proposal['title'] ?? '選定方案';
    final int expectedDays = (proposal['daySummaries'] as List?)?.length ?? 3;
    
    final List<dynamic> summaries = proposal['daySummaries'] ?? [];
    String summariesText = '';
    for (int i = 0; i < summaries.length; i++) {
      summariesText += '第 ${i + 1} 天核心主軸：${summaries[i]}\n';
    }

    final String prompt = [
      '我選定了方案：【$proposalTitle】。',
      '請根據以下這 $expectedDays 天的每日主軸，為我展開「每一天」的具體行程：',
      '----------------',
      summariesText.isNotEmpty ? summariesText : '請確保這 $expectedDays 天每天都有截然不同的行程。',
      '----------------',
      '⚠️【極度重要限制 - 嚴禁偷懶】：',
      '1. 旅遊總天數必須「精確等於 $expectedDays 天」，請產出 Day 1 到 Day $expectedDays 完整的 JSON。',
      '2. 每一天都必須安排 3~4 個「完全不同」的具體地點。',
      '3. 全程「嚴禁重複任何地點」！絕對不可以把第一天的景點複製到第二天或第三天。',
      '4. 必須使用「繁體中文」產出所有景點名稱、說明與概要。',
      '請立刻呼叫 update_itinerary 工具產出結果。'
    ].join('\n');

    _messages.add({'role': 'user', 'content': '我選定了方案：【$proposalTitle】，開始生成詳細行程！'});

    try {
      final res = await http.post(
        Uri.parse('$_baseUrl/api/chat'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'messages': [
            ..._messages.sublist(0, _messages.length - 1),
            {'role': 'user', 'content': prompt}
          ],
          'currentPlan': {'days': List.filled(expectedDays, {})}
        }),
      );

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        
        if (data['content'] != null) {
          _messages.add({'role': 'assistant', 'content': data['content']});
        }
        
        if (data['plan'] != null) {
          _currentPlan = data['plan'];
          hasNewPlan = true;
        }
      } else {
        _messages.add({'role': 'assistant', 'content': '產生行程失敗，後端未正確回傳。'});
      }
    } catch (e) {
      print('展開行程錯誤: $e');
      _messages.add({'role': 'assistant', 'content': '連線錯誤，無法產生詳細行程。'});
    } finally {
      _isSending = false;
      notifyListeners();
    }

    return hasNewPlan;
  }

  // 3. 清空聊天室 (開新行程用)
  void clearChat() {
    _messages = [
      {'role': 'assistant', 'content': '嗨，我是旅遊小助手！我可以幫你安排行程。'}
    ];
    _currentPlan = null;
    _currentProposals = null;
    notifyListeners();
  }

  // 4. 將目前的 AI 行程儲存到後端資料庫
  Future<bool> saveItinerary(String token) async {
    if (_currentPlan == null) {
      print('❌ 儲存失敗：目前沒有 currentPlan 資料');
      return false;
    }

    try {
      final String title = _currentPlan['city'] ?? '我的精彩行程';
      final String url = '$_baseUrl/api/itineraries';

      print('--- 準備儲存行程 ---');
      print('網址: $url');
      print('Token: ${token.substring(0, 10)}...'); // 只印前10碼確保隱私

      final res = await http.post(
        Uri.parse('$_baseUrl/api/itineraries'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'title': title,
          'startDate': _currentPlan['startDate'] ?? '',
          'startTime': _currentPlan['startTime'] ?? '09:00',
          'itineraryData': _currentPlan,
        }),
      );

      print('後端回傳狀態碼: ${res.statusCode}');
      print('後端回傳內容: ${res.body}');

      if (res.statusCode == 200 || res.statusCode == 201) {
        print('行程儲存成功！');
        return true;
      }else{
        print('❌ 後端拒絕儲存');
      }
    } catch (e) {
      print('儲存行程發生錯誤: $e');
    }
    return false;
  }

  // 🆕 新增這個方法：讓首頁點擊舊行程時，可以把歷史 JSON 塞回 currentPlan 狀態中
  void setCurrentPlan(dynamic plan) {
    _currentPlan = plan;
    _currentProposals = null; // 確保歷史行程不會被提案卡片干擾
    notifyListeners(); // 刷新狀態
  }
}