import 'dart:convert';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  String _getBaseUrl() {
    if (kIsWeb) return 'http://localhost:8888';
    if (Platform.isAndroid) return 'http://10.0.2.2:8888';
    return 'http://127.0.0.1:8888';
  }

  void _showLogoutDialog(BuildContext context, AuthProvider auth) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('登出確認', style: TextStyle(fontWeight: FontWeight.bold)),
        content: const Text('確定要登出您的帳號嗎？'),
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('取消', style: TextStyle(color: Colors.grey))),
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              auth.logout();
            },
            child: const Text('登出', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  // 🆕 核心修復：處理時區偏移，確保把失去的時差補回來！
  String _formatLocalBirthday(String? rawDate) {
    if (rawDate == null || rawDate.isEmpty) return '';
    try {
      // 將 UTC 時間轉回手機的本地時區 (例如台灣 +8)
      final date = DateTime.parse(rawDate).toLocal();
      return "${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}";
    } catch (e) {
      // 防呆：如果解析失敗才退回字串切割
      return rawDate.length >= 10 ? rawDate.substring(0, 10) : rawDate;
    }
  }

  void _openEditProfileSheet(BuildContext context, AuthProvider auth, Map<String, dynamic> user) {
    final nameCtrl = TextEditingController(text: user['displayname'] ?? user['displayName'] ?? '');
    final locationCtrl = TextEditingController(text: user['location'] ?? '');
    String selectedGender = user['gender'] ?? 'secret';
    
    // 🆕 使用時區校正函數
    final birthdayCtrl = TextEditingController(text: _formatLocalBirthday(user['birthday']));

    showModalBottomSheet(
      context: context,
      isScrollControlled: true, 
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (BuildContext ctx, StateSetter setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(ctx).viewInsets.bottom, 
                left: 24, right: 24, top: 24,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('編輯個人資料', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Color(0xFF0F766E))),
                    const SizedBox(height: 24),

                    TextField(
                      controller: nameCtrl,
                      maxLength: 60,
                      decoration: const InputDecoration(labelText: '顯示名稱', border: OutlineInputBorder(), prefixIcon: Icon(Icons.person)),
                    ),
                    const SizedBox(height: 16),

                    DropdownButtonFormField<String>(
                      value: selectedGender,
                      decoration: const InputDecoration(labelText: '性別', border: OutlineInputBorder(), prefixIcon: Icon(Icons.wc)),
                      items: const [
                        DropdownMenuItem(value: 'male', child: Text('男性')),
                        DropdownMenuItem(value: 'female', child: Text('女性')),
                        DropdownMenuItem(value: 'other', child: Text('其他')),
                        DropdownMenuItem(value: 'secret', child: Text('保密')),
                      ],
                      onChanged: (val) {
                        if (val != null) setModalState(() => selectedGender = val);
                      },
                    ),
                    const SizedBox(height: 16),

                    TextField(
                      controller: locationCtrl,
                      maxLength: 120,
                      decoration: const InputDecoration(labelText: '居住地 (選填)', border: OutlineInputBorder(), prefixIcon: Icon(Icons.location_on)),
                    ),
                    const SizedBox(height: 16),

                    TextField(
                      controller: birthdayCtrl,
                      readOnly: true,
                      decoration: const InputDecoration(labelText: '生日 (選填)', border: OutlineInputBorder(), prefixIcon: Icon(Icons.cake)),
                      onTap: () async {
                        DateTime? pickedDate = await showDatePicker(
                          context: ctx,
                          initialDate: DateTime(2000),
                          firstDate: DateTime(1900),
                          lastDate: DateTime.now(),
                          builder: (context, child) {
                            return Theme(
                              data: Theme.of(context).copyWith(
                                colorScheme: const ColorScheme.light(
                                  primary: Color(0xFF0F766E),
                                  onPrimary: Colors.white,
                                  onSurface: Colors.black,
                                ),
                              ),
                              child: child!,
                            );
                          },
                        );
                        if (pickedDate != null) {
                          setModalState(() {
                            birthdayCtrl.text = pickedDate.toString().substring(0, 10);
                          });
                        }
                      },
                    ),
                    const SizedBox(height: 24),

                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: FilledButton(
                        style: FilledButton.styleFrom(backgroundColor: const Color(0xFF0F766E)),
                        onPressed: () async {
                          if (nameCtrl.text.trim().isEmpty) {
                            ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(content: Text('顯示名稱不能為空！')));
                            return;
                          }

                          Navigator.pop(ctx);
                          showDialog(context: context, barrierDismissible: false, builder: (_) => const Center(child: CircularProgressIndicator()));
                          
                          try {
                            final res = await http.patch(
                              Uri.parse('${_getBaseUrl()}/api/users/me'),
                              headers: {
                                'Authorization': 'Bearer ${auth.token}',
                                'Content-Type': 'application/json',
                              },
                              body: jsonEncode({
                                'displayname': nameCtrl.text.trim(),
                                'gender': selectedGender,
                                'location': locationCtrl.text.trim().isEmpty ? null : locationCtrl.text.trim(),
                                'birthday': birthdayCtrl.text.trim().isEmpty ? null : birthdayCtrl.text.trim(),
                              }),
                            );

                            if (context.mounted) Navigator.pop(context); 

                            if (res.statusCode == 200) {
                              final updatedData = jsonDecode(res.body)['data'] ?? jsonDecode(res.body);
                              auth.updateUserData(updatedData); 
                              
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('✅ 個人資料已成功更新！')));
                              }
                            } else {
                              final errText = jsonDecode(res.body)['error'] ?? '更新失敗';
                              if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('❌ $errText')));
                            }
                          } catch (e) {
                            if (context.mounted) Navigator.pop(context);
                            if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('❌ 網路連線錯誤')));
                          }
                        },
                        child: const Text('儲存變更', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      ),
                    ),
                    const SizedBox(height: 32),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  String _translateGender(String? gender) {
    switch (gender) {
      case 'male': return '男性';
      case 'female': return '女性';
      case 'other': return '其他';
      default: return '保密';
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final user = auth.user ?? {};
    final userName = user['displayname'] ?? user['displayName'] ?? '旅人';
    final userEmail = user['email'] ?? 'traveler@example.com';
    
    // 🆕 使用時區校正函數顯示日期
    String displayBirthday = _formatLocalBirthday(user['birthday']);
    if (displayBirthday.isEmpty) displayBirthday = '未設定';

    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: const Text('我的帳號', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 1,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            elevation: 0,
            color: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: Colors.grey[200]!)),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 36,
                    backgroundColor: const Color(0xFF0F766E),
                    child: Text(
                      userName.isNotEmpty ? userName[0].toUpperCase() : 'U',
                      style: const TextStyle(fontSize: 32, color: Colors.white, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(userName, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 4),
                        Text(userEmail, style: TextStyle(fontSize: 14, color: Colors.grey[600])),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          
          const SizedBox(height: 24),
          const Padding(
            padding: EdgeInsets.only(left: 8, bottom: 8),
            child: Text('詳細資訊', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.grey)),
          ),

          Card(
            elevation: 0,
            color: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: Colors.grey[200]!)),
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.wc, color: Color(0xFF0F766E)),
                  title: const Text('性別', style: TextStyle(color: Colors.grey, fontSize: 14)),
                  subtitle: Text(_translateGender(user['gender']), style: const TextStyle(color: Colors.black87, fontSize: 16)),
                ),
                const Divider(height: 1, indent: 16, endIndent: 16),
                ListTile(
                  leading: const Icon(Icons.location_on, color: Color(0xFF0F766E)),
                  title: const Text('居住地', style: TextStyle(color: Colors.grey, fontSize: 14)),
                  subtitle: Text(user['location']?.isNotEmpty == true ? user['location'] : '未設定', style: const TextStyle(color: Colors.black87, fontSize: 16)),
                ),
                const Divider(height: 1, indent: 16, endIndent: 16),
                ListTile(
                  leading: const Icon(Icons.cake, color: Color(0xFF0F766E)),
                  title: const Text('生日', style: TextStyle(color: Colors.grey, fontSize: 14)),
                  subtitle: Text(displayBirthday, style: const TextStyle(color: Colors.black87, fontSize: 16)),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),
          const Padding(
            padding: EdgeInsets.only(left: 8, bottom: 8),
            child: Text('帳號設定', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.grey)),
          ),

          Card(
            elevation: 0,
            color: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: Colors.grey[200]!)),
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.edit, color: Color(0xFF0F766E)),
                  title: const Text('編輯個人資料'),
                  trailing: const Icon(Icons.chevron_right, color: Colors.grey),
                  onTap: () => _openEditProfileSheet(context, auth, user),
                ),
                const Divider(height: 1, indent: 16, endIndent: 16),
                ListTile(
                  leading: const Icon(Icons.lock_outline, color: Color(0xFF0F766E)),
                  title: const Text('重設密碼'),
                  trailing: const Icon(Icons.chevron_right, color: Colors.grey),
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('密碼功能即將開放')));
                  },
                ),
                const Divider(height: 1, indent: 16, endIndent: 16),
                ListTile(
                  leading: const Icon(Icons.logout, color: Colors.redAccent),
                  title: const Text('登出', style: TextStyle(color: Colors.redAccent)),
                  onTap: () => _showLogoutDialog(context, auth),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}