package com.erp.businessos.ui
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
class MainActivity:ComponentActivity(){override fun onCreate(savedInstanceState:Bundle?){super.onCreate(savedInstanceState);setContent{BusinessOSApp()}}}
@Composable fun BusinessOSApp(){var tab by remember{mutableStateOf("Dashboard")};MaterialTheme{Scaffold(bottomBar={NavigationBar{listOf("Dashboard","Products","Sales","Customers","AI").forEach{label->NavigationBarItem(selected=tab==label,onClick={tab=label},icon={},label={Text(label)})}}}){p->Column(Modifier.padding(p).padding(20.dp)){Text("BusinessOS",style=MaterialTheme.typography.headlineMedium);Spacer(Modifier.height(18.dp));when(tab){"Dashboard"->Text("Revenue • Profit • Due • Stock");"Products"->Text("Products & Categories");"Sales"->Text("Sales & GST invoices");"Customers"->Text("Customers & Suppliers");"AI"->Text("AI Business Assistant")}}}}}
