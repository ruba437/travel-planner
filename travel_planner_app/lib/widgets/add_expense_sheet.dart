import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import '../providers/auth_provider.dart';

class AddExpenseSheet extends StatefulWidget {
  final String tripId; // 綁定這筆花費是屬於哪個行程的

  const AddExpenseSheet({super.key, required this.tripId});

  @override
  State<AddExpenseSheet> createState() => _AddExpenseSheetState();
}

class _AddExpenseSheetState extends State<AddExpenseSheet> {
  final _amountController = TextEditingController();
  final _descController = TextEditingController();
  String _selectedCategory = 'food'; // 預設分類
  bool _isLoading = false;

  final Map<String, Map<String, dynamic>> _categories = {
    'food': {'icon': '🍔', 'label': '飲食'},
    'transport': {'icon': '🚗', 'label': '交通'},
    'shopping': {'icon': '🛍️', 'label': '購物'},
    'activity': {'icon': '🎟️', 'label': '娛樂'},
    'accommodation': {'icon': '🏠', 'label': '住宿'},
  };

  String _getBaseUrl() {
    if (kIsWeb) return 'http://localhost:8888';
    if (Platform.isAndroid) return 'http://10.0.2.2:8888';
    return 'http://127.0.0.1:8888';
  }

  Future<void> _submitExpense() async {
    final amount = double.tryParse(_amountController.text);
    final desc = _descController.text.trim();

    if (amount == null || amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('請輸入有效的金額！')));
      return;
    }

    setState(() => _isLoading = true);

    final token = Provider.of<AuthProvider>(context, listen: false).token;
    
    try {
      // ⚠️ 這裡假設你的後端有一支 POST /api/expenses 的 API
      // 如果你的 API 網址不同，請在這裡修改！
      final res = await http.post(
        Uri.parse('${_getBaseUrl()}/api/trips/${widget.tripId}/expenses'),
        headers: {
          'Content-Type': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'amount': amount,
          'category': _selectedCategory,
          'description': desc,
          'date': DateTime.now().toIso8601String(),
        }),
      );

      if (res.statusCode == 200 || res.statusCode == 201) {
        if (mounted) {
          Navigator.pop(context, true); // 成功！關閉表單並回傳 true
        }
      } else {
        throw Exception('API 錯誤: ${res.body}');
      }
    } catch (e) {
      debugPrint('記帳失敗: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('❌ 記帳失敗: $e')));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // 讓底部表單會被鍵盤往上推
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: bottomInset + 20),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('新增花費', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
            ],
          ),
          const SizedBox(height: 16),
          
          // 💰 金額輸入框
          TextField(
            controller: _amountController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Color(0xFF0F766E)),
            decoration: const InputDecoration(
              prefixText: '\$ ',
              prefixStyle: TextStyle(fontSize: 32, color: Colors.black54),
              labelText: '金額',
              border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(12))),
            ),
          ),
          const SizedBox(height: 16),

          // 🏷️ 分類選擇 (Choice Chips)
          const Text('選擇分類', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _categories.entries.map((entry) {
              final isSelected = _selectedCategory == entry.key;
              return ChoiceChip(
                label: Text('${entry.value['icon']} ${entry.value['label']}'),
                selected: isSelected,
                selectedColor: const Color(0xFF0F766E).withOpacity(0.2),
                labelStyle: TextStyle(
                  color: isSelected ? const Color(0xFF0F766E) : Colors.black87,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                ),
                onSelected: (bool selected) {
                  if (selected) setState(() => _selectedCategory = entry.key);
                },
              );
            }).toList(),
          ),
          const SizedBox(height: 16),

          // 📝 備註輸入框
          TextField(
            controller: _descController,
            decoration: const InputDecoration(
              labelText: '備註 (選填，例如：買給家人的伴手禮)',
              border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(12))),
              prefixIcon: Icon(Icons.edit_note),
            ),
          ),
          const SizedBox(height: 24),

          // 🚀 送出按鈕
          SizedBox(
            width: double.infinity,
            height: 50,
            child: FilledButton(
              onPressed: _isLoading ? null : _submitExpense,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF0F766E),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _isLoading 
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('儲存', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }
}