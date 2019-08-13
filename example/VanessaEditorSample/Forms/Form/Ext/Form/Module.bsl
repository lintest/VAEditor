﻿#Region FormEvents

&AtServer
Procedure OnCreateAtServer(Cancel, StandardProcessing)
	
	LoadVanessaEditor();
	
EndProcedure

&AtClient
Procedure LoadFile(Command)
	
	Dialog = New FileDialog(FileDialogMode.Open);
	If Dialog.Choose() Then 
		TextReader = New TextReader(Dialog.FullFileName, TextEncoding.UTF8);
		Text = TextReader.Read();
		
		VanessaEditorSendAction("setValue", Text);
	EndIf;
	
EndProcedure

&AtClient
Procedure GetValue(Command)
	
	UserMessage = New UserMessage;
	UserMessage.Text = VanessaEditorSendAction("getValue");
	UserMessage.Message();
	
EndProcedure

&AtClient
Procedure ReadOnlyModeOnChange(Item)
	
	If ReadOnlyMode Then
		VanessaEditorSendAction("disableEdit");
	Else 
		VanessaEditorSendAction("enableEdit");
	EndIf;
	
EndProcedure

#EndRegion

#Region Breakpoints

&AtClient
Procedure BreakpointsOnChange(Item)
	
	DecorateBreakpoints();
	
EndProcedure

&AtClient
Procedure BreakpointsBeforeEditEnd(Item, NewRow, CancelEdit, Cancel)
	
	Breakpoints.SortByValue();
	
	Value = 0;
	For Each Row In Breakpoints Do
		If Value = Row.Value Then
			Cancel = True;
			Return;
		EndIf;
		Value = Row.Value;
	EndDo;
	
EndProcedure

&AtClient
Procedure BreakpointsOnActivateRow(Item)
	
	If Item.CurrentData = Undefined Then
		Return;
	EndIf;
	
	VanessaEditorSendAction("revealLine", Item.CurrentData.Value);
	
EndProcedure

&AtClient
Procedure UpdateBreakpoints(Json)
	
	BreakpointsPacket = JsonLoad(Json);
	
	Breakpoints.Clear();
	For Each Chunk In BreakpointsPacket Do
		Breakpoints.Add(Chunk.lineNumber,, Chunk.enable);
	EndDo;
	
	Breakpoints.SortByValue();
	
	If EmulateBreakpointUpdateDelay Then 
		Sleep();
	EndIf;
	
EndProcedure

&AtClient
Procedure DecorateBreakpoints()
	
	BreakpointsPacket = New Array;
	
	For Each Row In Breakpoints Do
		Chunk = New Structure;
		Chunk.Insert("lineNumber", Row.Value);
		Chunk.Insert("enable", Row.Check);
		BreakpointsPacket.Add(Chunk);
	EndDo;
	
	VanessaEditorSendAction("decorateBreakpoints", JsonDump(BreakpointsPacket));
	
EndProcedure

#EndRegion

#Region Json

&AtClient
Function JsonLoad(Json)
	
	JSONReader = New JSONReader;
	JSONReader.SetString(Json);
	Value = ReadJSON(JSONReader);
	JSONReader.Close();
	Return Value;
	
EndFunction

&AtClient
Function JsonDump(Value)
	
	JSONWriter = New JSONWriter;
	JSONWriter.SetString();
	WriteJSON(JSONWriter, Value);
	Return JSONWriter.Close();
	
EndFunction

#EndRegion

#Region Utils

Procedure Sleep(Delay = 1)
	
	RunApp("timeout " + Delay,, True);
	
EndProcedure

#EndRegion

#Region VanessaEditor

#Region Public

&AtClient
Function VanessaEditorSendAction(Action, Arg = Undefined)
	
	Return Items.VanessaEditor.Document.defaultView.VanessaEditorOnReceiveAction(Action, Arg);
	
EndFunction

&AtClient
Procedure VanessaEditorOnReceiveEvent(Event, Arg)
	
	If Event = "CONTENT_DID_CHANGE" Then
		ContentDidChange = True;
	ElsIf Event = "UPDATE_BREAKPOINTS" Then
		UpdateBreakpoints(Arg);
		DecorateBreakpoints();
	Else
		UserMessage = New UserMessage;
		UserMessage.Text = Event + " : " + Arg;
		UserMessage.Message();
	EndIf;
	
EndProcedure

#EndRegion

#Region Private

&AtServer
Procedure LoadVanessaEditor()
	
	VanessaEditor = GetInfoBaseURL() + "/" + PutToTempStorage(
		FormAttributeToValue("Object").GetTemplate("VanessaEditor"), UUID);
	
EndProcedure

&AtClient
Procedure VanessaEditorEventForwaderOnReceiveEvent(Item, EventData, StandardProcessing)
	
	Element = EventData.Element;
	If Element.id = "VanessaEditorEventForwader" Then
		VanessaEditorOnReceiveEvent(Element.title, Element.value);
	EndIf;
	
EndProcedure

#EndRegion

#EndRegion